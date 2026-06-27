// One-off migration: re-base photos.x_percent / y_percent from the OLD semantics
// ("normalized against the 3:2 render frame, letterbox included") to the NEW
// semantics ("normalized against the image's REAL content rectangle", so
// u·subMap.width / v·subMap.height is a true pixel on the chart).
//
// Task: 05-27-image-relative-coords (PR1 — migration script; renderer is PR2).
//
// WHY a Node script and not a Drizzle SQL migration: the per-photo conversion
// factor r = subMap.width / subMap.height lives ONLY in data/venues/*.json
// (ADR-1: venue metadata is static JSON, never in D1). The photos table has no
// FK / join path to a sub-map's intrinsic pixels, so SQL alone cannot compute
// the new coordinates. This script reads the venue JSON (same loader pattern as
// gen-demo-seed.mjs), resolves each row's (venue_id, sub_map_id) -> width/height,
// computes the new (u, v) per id, and applies precise per-id UPDATEs via
// `wrangler d1 execute`.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   node scripts/migrate-coords-frame-to-image.mjs --dry-run            # local DB, print only
//   node scripts/migrate-coords-frame-to-image.mjs --local              # apply to local D1
//   node scripts/migrate-coords-frame-to-image.mjs --remote --dry-run   # prod, print only
//   node scripts/migrate-coords-frame-to-image.mjs --remote             # apply to PROD D1
//   node scripts/migrate-coords-frame-to-image.mjs --local --force      # re-apply despite the journal (DANGER)
//   node scripts/migrate-coords-frame-to-image.mjs --rollback scripts/backups/coords-backup-<ts>.json
//   node scripts/migrate-coords-frame-to-image.mjs --rollback <file> --remote
//
// Default target is --local. --remote is opt-in and NEVER implied (prod is only
// touched when a human passes --remote). A backup JSON of every row's id + old
// x/y is always written before any forward migration (skipped on --dry-run).
//
// ── Replay safety (the biggest footgun) ──────────────────────────────────────
// The conversion is NOT idempotent: running it twice double-converts and corrupts
// data. Guard: a per-target LOCAL JOURNAL FILE `scripts/backups/.migrated-
// <target>.json` (target = local | remote) is written after a successful apply.
// Before a forward run the script checks for that file; if it exists it ABORTS
// (use --rollback, or archive/delete the journal, or pass --force to override).
// A successful --rollback DELETES the journal so a fresh forward run is allowed.
//
// WHY a journal file and not a DB sentinel column: the photos schema is LOCKED
// ("不动 schema", prd.md Decisions). Adding a `coords_migrated_at` column via
// ALTER TABLE would diverge from src/server/db/schema.ts (drizzle drift) and
// touch the very schema this task promised to leave alone. The journal keeps the
// replay guard entirely outside the database. (See data-migration-surface.md
// "幂等性风险".)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const venuesDir = join(root, "data", "venues");
const backupsDir = join(root, "scripts", "backups");

const DB_NAME = "seatmap-real"; // wrangler.jsonc d1_databases[].database_name

// Per-target replay-guard journal. Written after a successful forward apply,
// deleted by a successful rollback. local vs remote get separate journals so a
// local test run never blocks (or unblocks) a prod run.
function journalPath(remote) {
  return join(backupsDir, `.migrated-${remote ? "remote" : "local"}.json`);
}

// ── imageContentRect: a faithful COPY of src/lib/image-rect.ts ───────────────
// .mjs cannot import the .ts module, so this is duplicated on purpose. The
// migration's correctness DEPENDS on this being byte-for-byte equivalent to the
// renderer's geometry: the new coordinate value the renderer reads back is
// (point - offset) / contentSize, so the inverse we apply here MUST use the same
// content rect. If src/lib/image-rect.ts ever changes, update this copy too.
function imageContentRect(containerW, containerH, naturalW, naturalH) {
  if (naturalW <= 0 || naturalH <= 0 || containerW <= 0 || containerH <= 0) {
    return { offsetX: 0, offsetY: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    offsetX: (containerW - width) / 2,
    offsetY: (containerH - height) / 2,
    width,
    height,
  };
}

// The OLD coords were normalized against a 3:2 render frame (object-contain
// letterbox baked in). Model that frame as a 1.5 × 1 box, find where an image of
// natural (w, h) sits inside it (object-contain), and re-normalize the old point
// against THAT content rect — exactly the inverse of what the PR2 renderer does
// when it maps the new (u, v) back onto the image. This is algebraically equal to
// the PRD's piecewise r>1.5 / r<1.5 / r=1.5 formula, but expressed via the shared
// geometry so the two can never drift.
function frameToImage(oldX, oldY, width, height) {
  const rect = imageContentRect(1.5, 1, width, height);
  const u = (oldX * 1.5 - rect.offsetX) / rect.width;
  const v = (oldY * 1 - rect.offsetY) / rect.height;
  return { u, v };
}

// ── venue JSON -> { [venueId]: { [subMapId]: { width, height } } } ───────────
async function loadSubMapDims() {
  const files = (await readdir(venuesDir)).filter((f) => f.endsWith(".json"));
  files.sort();
  /** @type {Record<string, Record<string, {width:number,height:number}>>} */
  const map = {};
  for (const file of files) {
    const venue = JSON.parse(await readFile(join(venuesDir, file), "utf8"));
    map[venue.id] = {};
    for (const subMap of venue.subMaps ?? []) {
      map[venue.id][subMap.id] = {
        width: subMap.width,
        height: subMap.height,
      };
    }
  }
  return map;
}

// ── wrangler helpers ─────────────────────────────────────────────────────────
// Invoke wrangler's JS entrypoint directly with `node` (not the `npx`/`wrangler`
// shell shim). This passes args VERBATIM via spawnSync's argv array — no shell
// re-tokenization, so a `--command "SELECT ... FROM ..."` value with spaces
// survives as one argument on every platform (the `.cmd` shim under shell:true
// mangles it on Windows).
const wranglerBin = join(
  root,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

function wranglerExecute(args) {
  const result = spawnSync(
    process.execPath,
    [wranglerBin, "d1", "execute", ...args],
    { cwd: root, encoding: "utf8" },
  );
  if (result.error) {
    throw new Error(`failed to spawn wrangler: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr || result.stdout || "";
    throw new Error(`wrangler d1 execute ${args.join(" ")} failed:\n${stderr}`);
  }
  return result.stdout;
}

function locFlag(remote) {
  return remote ? "--remote" : "--local";
}

// `wrangler d1 execute --json` prints an array of result objects; the rows live
// under [0].results. Be defensive about wrapper noise.
function parseD1Json(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find JSON array in wrangler output:\n${stdout}`);
  }
  const parsed = JSON.parse(stdout.slice(start, end + 1));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

function queryRows(remote, sql) {
  const out = wranglerExecute([
    DB_NAME,
    locFlag(remote),
    "--json",
    "--command",
    sql,
  ]);
  return parseD1Json(out);
}

function execFile(remote, filePath) {
  return wranglerExecute([
    DB_NAME,
    locFlag(remote),
    "-y",
    `--file=${filePath}`,
  ]);
}

function sqlNum(n) {
  // Plain finite number, no quoting; clamp tiny float noise is NOT applied here
  // (we keep full precision and let the renderer clamp 0..1 on read).
  if (!Number.isFinite(n)) throw new Error(`non-finite coordinate: ${n}`);
  return String(n);
}

// ── modes ────────────────────────────────────────────────────────────────────

async function runForward({ remote, dryRun, force }) {
  const dims = await loadSubMapDims();

  // Replay guard: a journal file for this target means a forward migration was
  // already applied. The conversion is NOT idempotent, so refuse to re-run.
  // (--dry-run is read-only and skips the guard so a preview is always allowed.)
  const journal = journalPath(remote);
  if (!dryRun && existsSync(journal)) {
    if (force) {
      console.warn(
        `[${locFlag(remote)}] WARNING: --force overriding the replay guard. ` +
          `Journal ${journal} indicates this target was ALREADY migrated; ` +
          `re-applying will DOUBLE-CONVERT and corrupt coordinates unless the ` +
          `data was rolled back to old semantics first. Proceeding anyway.`,
      );
    } else {
      console.error(
        `[${locFlag(remote)}] ABORT: this target was already migrated (journal: ` +
          `${journal}). The conversion is not idempotent — re-running would ` +
          `double-convert. To re-migrate: --rollback <backup.json> (deletes the ` +
          `journal), or archive/delete the journal manually, or pass --force.`,
      );
      process.exit(1);
    }
  }

  // Pull every row (incl. soft-deleted: migrate them too so a restored row is
  // not left in old semantics — data-migration-surface.md "软删行").
  const rows = queryRows(
    remote,
    `SELECT id, venue_id, sub_map_id, x_percent, y_percent FROM photos;`,
  );

  if (rows.length === 0) {
    console.log(
      `[${locFlag(remote)}] photos table is empty — nothing to migrate.`,
    );
    return;
  }

  // Resolve dims + compute new coords; HARD-FAIL on any missing JSON mapping.
  const missing = [];
  const updates = []; // { id, oldX, oldY, u, v, venueId, subMapId, r }
  for (const row of rows) {
    const venue = dims[row.venue_id];
    const subMap = venue?.[row.sub_map_id];
    if (!subMap || !(subMap.width > 0) || !(subMap.height > 0)) {
      missing.push(`${row.id}  (${row.venue_id} / ${row.sub_map_id})`);
      continue;
    }
    const { u, v } = frameToImage(
      row.x_percent,
      row.y_percent,
      subMap.width,
      subMap.height,
    );
    updates.push({
      id: row.id,
      oldX: row.x_percent,
      oldY: row.y_percent,
      u,
      v,
      venueId: row.venue_id,
      subMapId: row.sub_map_id,
      r: subMap.width / subMap.height,
    });
  }

  if (missing.length > 0) {
    console.error(
      `ABORT: ${missing.length} photo row(s) have a (venue_id, sub_map_id) with ` +
        `no matching sub-map in data/venues/*.json. Resolve these by hand before ` +
        `migrating (do NOT migrate with a guessed ratio):`,
    );
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  // Print a summary + sampled before/after rows across the three r branches.
  printSummary({ remote, total: rows.length, updates });

  if (dryRun) {
    console.log(
      `\n[dry-run] ${updates.length} UPDATE(s) would be applied to ` +
        `${locFlag(remote)}. No changes made.`,
    );
    return;
  }

  // Write the backup BEFORE touching anything.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupsDir, `coords-backup-${ts}.json`);
  await mkdir(backupsDir, { recursive: true });
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        db: DB_NAME,
        target: locFlag(remote),
        createdAt: Date.now(),
        // Back up EVERY row's pre-migration coords so a rollback restores the
        // full table state.
        rows: rows.map((r) => ({
          id: r.id,
          x_percent: r.x_percent,
          y_percent: r.y_percent,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nBackup written: ${backupPath} (${rows.length} rows)`);

  // Build one SQL file: per-id UPDATE (coords only — schema is NOT touched).
  // NO explicit `BEGIN TRANSACTION; ... COMMIT;`: real D1 (`--remote`) REJECTS
  // SQL-level transactions ("To execute a transaction, please use the
  // state.storage.transaction() ... instead of the SQL BEGIN TRANSACTION"). The
  // local miniflare/sqlite ALLOWS them, so a local-only test does NOT surface
  // this — it caused the first prod migration to fail at the BEGIN line.
  // Atomicity is preserved anyway: `wrangler d1 execute --file` runs all the
  // file's statements as ONE implicit batch (all-or-nothing).
  const sqlLines = [];
  for (const u of updates) {
    sqlLines.push(
      `UPDATE photos SET x_percent = ${sqlNum(u.u)}, y_percent = ${sqlNum(
        u.v,
      )} WHERE id = '${u.id}';`,
    );
  }

  const sqlPath = join(backupsDir, `coords-migrate-${ts}.sql`);
  await writeFile(sqlPath, sqlLines.join("\n") + "\n", "utf8");
  console.log(`Generated SQL: ${sqlPath} (${updates.length} UPDATEs)`);

  console.log(`\nApplying to ${locFlag(remote)} ...`);
  execFile(remote, sqlPath);

  // Record the journal (replay guard) only AFTER a successful apply, pointing
  // back at the backup so an operator knows which file rolls this run back.
  await writeFile(
    journal,
    JSON.stringify(
      {
        db: DB_NAME,
        target: locFlag(remote),
        migratedAt: Date.now(),
        rowCount: updates.length,
        backupFile: backupPath,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Wrote replay-guard journal: ${journal}`);
  console.log(`Done. Migrated ${updates.length} row(s).`);
}

async function runRollback({ remote, backupFile }) {
  const raw = JSON.parse(await readFile(resolve(root, backupFile), "utf8"));
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
    throw new Error(`backup file has no rows: ${backupFile}`);
  }
  console.log(
    `Rolling back ${raw.rows.length} row(s) on ${locFlag(remote)} from ` +
      `${backupFile} (db=${raw.db ?? "?"}, taken ${
        raw.createdAt ? new Date(raw.createdAt).toISOString() : "?"
      }).`,
  );

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  // No explicit SQL transaction: D1 `--remote` rejects BEGIN/COMMIT (see the
  // forward path). `d1 execute --file` runs the file as one atomic batch.
  const sqlLines = [];
  for (const row of raw.rows) {
    // Restore old coords (schema is untouched — nothing else to reset).
    sqlLines.push(
      `UPDATE photos SET x_percent = ${sqlNum(row.x_percent)}, y_percent = ${sqlNum(
        row.y_percent,
      )} WHERE id = '${row.id}';`,
    );
  }

  await mkdir(backupsDir, { recursive: true });
  const sqlPath = join(backupsDir, `coords-rollback-${ts}.sql`);
  await writeFile(sqlPath, sqlLines.join("\n") + "\n", "utf8");
  console.log(`Generated rollback SQL: ${sqlPath}`);

  console.log(`Applying rollback to ${locFlag(remote)} ...`);
  execFile(remote, sqlPath);

  // Delete the replay-guard journal so a fresh forward run is allowed again.
  // Rollback targets the same DB the backup was taken from (--remote selects the
  // prod journal); default --local clears the local journal.
  const journal = journalPath(remote);
  if (existsSync(journal)) {
    await rm(journal);
    console.log(`Removed replay-guard journal: ${journal}`);
  }
  console.log(`Rollback done. Restored ${raw.rows.length} row(s).`);
}

function printSummary({ remote, total, updates }) {
  console.log(`Target DB: ${locFlag(remote)} (${DB_NAME})`);
  console.log(`Rows: ${total} total | ${updates.length} to migrate`);

  // Sample one row from each r branch (r>1.5 / r<1.5 / r≈1.5) when present, so a
  // human can eyeball that the conversion is sane across letterbox orientations.
  const wide = updates.find((u) => u.r > 1.5 + 1e-9);
  const tall = updates.find((u) => u.r < 1.5 - 1e-9);
  const exact = updates.find((u) => Math.abs(u.r - 1.5) <= 1e-9);
  const samples = [
    ["r > 1.5 (top/bottom letterbox)", wide],
    ["r < 1.5 (left/right letterbox)", tall],
    ["r = 1.5 (no letterbox, unchanged)", exact],
  ];
  console.log("\nSampled old -> new (one per ratio branch):");
  for (const [label, u] of samples) {
    if (!u) {
      console.log(`  ${label}: (no row with this ratio)`);
      continue;
    }
    console.log(
      `  ${label}\n` +
        `    ${u.venueId} / ${u.subMapId}  r=${u.r.toFixed(4)}  id=${u.id}\n` +
        `    x: ${fmt(u.oldX)} -> ${fmt(u.u)}   y: ${fmt(u.oldY)} -> ${fmt(u.v)}`,
    );
  }
}

function fmt(n) {
  return Number(n).toFixed(4);
}

// ── arg parsing ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { remote: false, dryRun: false, force: false, rollback: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--remote") args.remote = true;
    else if (a === "--local") args.remote = false;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force") args.force = true;
    else if (a === "--rollback") {
      args.rollback = argv[i + 1];
      i += 1;
      if (!args.rollback || args.rollback.startsWith("--")) {
        throw new Error("--rollback requires a backup JSON file path");
      }
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.rollback) {
    await runRollback({ remote: args.remote, backupFile: args.rollback });
    return;
  }
  await runForward({
    remote: args.remote,
    dryRun: args.dryRun,
    force: args.force,
  });
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

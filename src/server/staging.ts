// D1 queries for the staging-area venue suggestions (R6).
//
// Mirrors src/server/photos.ts in shape: a read query (newest-first list, for
// SSR + the GET continuation) and a write helper (insert one suggestion). The
// row's `ip_hash` (abuse tracking) is never sent to the client — the list DTO
// only carries the public columns (R6.4 倒序展示). Read-only listing has no auth
// (already-public content); the write path carries Turnstile + KV limits in the
// /api/staging endpoint.

import { desc, eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { stagingVenues, type NewStagingVenueRow } from "@/server/db/schema";

/** Public staging-suggestion shape sent to the client (no `ip_hash`). */
export interface StagingVenueDto {
  id: string;
  /** User-authored venue name, kept verbatim (R9.5 — never translated). */
  name: string;
  /** Unix epoch ms. */
  createdAt: number;
  /** Whether a maintainer has marked it processed (R6 收录标记). */
  processed: boolean;
}

export interface ListStagingOptions {
  /** Skip this many rows (continuation paging). */
  offset?: number;
  /** Cap returned rows. */
  limit?: number;
}

/** Default page size for the staging list (text-only rows are light, §11). */
export const STAGING_BATCH = 50;

/**
 * List staging-area suggestions newest-first (R6.4). Strips `ip_hash` and maps
 * `processed_at` → a boolean `processed` flag (the exact timestamp is a
 * maintainer detail the client does not need).
 */
export async function listStagingVenues(
  db: Db,
  options: ListStagingOptions = {},
): Promise<StagingVenueDto[]> {
  const rows = await db
    .select()
    .from(stagingVenues)
    .orderBy(desc(stagingVenues.createdAt))
    .limit(options.limit ?? STAGING_BATCH)
    .offset(options.offset ?? 0);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    processed: row.processedAt != null,
  }));
}

/**
 * Insert one staging suggestion (R6 write path). Called by /api/staging AFTER
 * Turnstile + the 5/day KV limit pass. Returns the inserted row's client DTO so
 * the form can optimistically prepend it to the list (R6.4, newest first).
 */
export async function insertStagingVenue(
  db: Db,
  row: NewStagingVenueRow,
): Promise<StagingVenueDto> {
  await db.insert(stagingVenues).values(row);
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    processed: row.processedAt != null,
  };
}

// ── Maintainer admin (R7.2) ─────────────────────────────────────────────────
// Behind the Cloudflare Access gate (ADR-11). The admin staging list reuses the
// SAME `listStagingVenues` read above (it already exposes `processed`); the only
// extra operations are the two mutations below: mark processed / unprocessed
// (R7.2 "标记已处理") and delete a suggestion (R7.2 "删除已处理的提交"). The
// "转正式" promotion itself happens via GitHub PR, NOT here (R7.3) — the schema
// only tracks the `processed_at` triage flag.

/**
 * Mark a staging suggestion processed (set `processed_at = now`) or unprocessed
 * (clear it). Idempotent. Returns true when a row was affected, false when no
 * such id exists.
 */
export async function setStagingProcessed(
  db: Db,
  id: string,
  processed: boolean,
  now: number = Date.now(),
): Promise<boolean> {
  const existing = await db
    .select({ id: stagingVenues.id })
    .from(stagingVenues)
    .where(eq(stagingVenues.id, id))
    .limit(1);
  if (!existing[0]) return false;

  await db
    .update(stagingVenues)
    .set({ processedAt: processed ? now : null })
    .where(eq(stagingVenues.id, id));
  return true;
}

/**
 * Hard-delete a staging suggestion (R7.2 "删除已处理的提交"). Staging rows carry
 * no media and no soft-delete column (prd Data Model), so this is a real DELETE.
 * Returns true when a row was removed, false when the id was absent.
 */
export async function deleteStagingVenue(db: Db, id: string): Promise<boolean> {
  const existing = await db
    .select({ id: stagingVenues.id })
    .from(stagingVenues)
    .where(eq(stagingVenues.id, id))
    .limit(1);
  if (!existing[0]) return false;

  await db.delete(stagingVenues).where(eq(stagingVenues.id, id));
  return true;
}

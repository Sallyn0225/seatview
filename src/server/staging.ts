// D1 queries for the staging-area venue suggestions (R6) + the "+1" (附议) flow.
//
// Mirrors src/server/photos.ts in shape: a read query (most-seconded-first list,
// `vote_count DESC`, for SSR + the GET continuation), a write helper (insert one
// suggestion, with the submitter auto-counting as its first +1) and the +1
// helpers (addVote / countDistinctVotesToday). The row's `ip_hash` (abuse
// tracking) is never sent to the client — the list DTO only carries the public
// columns. Read-only listing has no auth (already-public content); the submit
// path carries Turnstile + KV limits in /api/staging, while +1 is bounded purely
// in D1 (permanent per-venue dedup + a 5-different-venues/day cap).

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import type { StagingNameDto } from "@/lib/staging";
import { newId } from "@/server/id";
import {
  stagingVenues,
  stagingVotes,
  type NewStagingVenueRow,
} from "@/server/db/schema";

/** Public staging-suggestion shape sent to the client (no `ip_hash`). */
export interface StagingVenueDto {
  id: string;
  /** User-authored venue name, kept verbatim (R9.5 — never translated). */
  name: string;
  /** Unix epoch ms. */
  createdAt: number;
  /** Whether a maintainer has marked it processed (R6 收录标记). */
  processed: boolean;
  /** "+1" tally (附议数). Always ≥1 — the submitter auto-counts as the first. */
  voteCount: number;
  /** Whether THIS viewer (by ip_hash) has already +1'd this venue → disable button. */
  votedByMe: boolean;
}

export interface ListStagingOptions {
  /** Skip this many rows (continuation paging). */
  offset?: number;
  /** Cap returned rows. */
  limit?: number;
  /**
   * Viewer's salted IP hash. When given, each returned row's `votedByMe` reflects
   * whether this viewer already +1'd it (one extra query over the page). Omit
   * (e.g. unknown IP) → all `votedByMe` are false.
   */
  viewerIpHash?: string;
  /**
   * Drop already-collected rows (`processed_at IS NULL`, issue #41). The PUBLIC
   * staging page passes this so a 已收录 venue stops cluttering the wishlist; the
   * maintainer triage list omits it (admin still needs to see + manage them).
   * Filtering in the query keeps offset paging self-consistent.
   */
  excludeProcessed?: boolean;
}

/** Default page size for the staging list (text-only rows are light, §11). */
export const STAGING_BATCH = 50;

/**
 * List staging-area suggestions, **most-seconded first** (`vote_count DESC`,
 * then `created_at DESC` as tiebreak — demand-strength signal for maintainers).
 * Strips `ip_hash` and maps `processed_at` → a boolean `processed` flag. When
 * `viewerIpHash` is given, marks each row's `votedByMe` so the client can disable
 * the +1 button on venues this viewer already seconded.
 */
export async function listStagingVenues(
  db: Db,
  options: ListStagingOptions = {},
): Promise<StagingVenueDto[]> {
  const rows = await db
    .select()
    .from(stagingVenues)
    .where(
      options.excludeProcessed ? isNull(stagingVenues.processedAt) : undefined,
    )
    .orderBy(desc(stagingVenues.voteCount), desc(stagingVenues.createdAt))
    .limit(options.limit ?? STAGING_BATCH)
    .offset(options.offset ?? 0);

  // One query marks which of THIS page's venues the viewer already +1'd.
  let votedSet = new Set<string>();
  if (options.viewerIpHash && rows.length > 0) {
    const voted = await db
      .select({ venueId: stagingVotes.venueId })
      .from(stagingVotes)
      .where(
        and(
          eq(stagingVotes.ipHash, options.viewerIpHash),
          inArray(
            stagingVotes.venueId,
            rows.map((r) => r.id),
          ),
        ),
      );
    votedSet = new Set(voted.map((v) => v.venueId));
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    processed: row.processedAt != null,
    voteCount: row.voteCount,
    votedByMe: votedSet.has(row.id),
  }));
}

/**
 * Lightweight list for the staging-area dedup-match corpus (issue #3). Returns
 * ONLY the public {id, name, voteCount, processed}, most-seconded first, capped
 * at `limit`. Deliberately has NO per-viewer `votedByMe` query (so GET
 * /api/staging/names is public-cacheable at the edge) and NO `ip_hash`;
 * `processed` is viewer-independent so it stays public (issue #15 — the form
 * hides the +1 on an already-collected hint match). Backs the staging form's
 * "this venue may already exist / already be requested" hint.
 */
export async function listStagingNames(
  db: Db,
  limit: number,
): Promise<StagingNameDto[]> {
  const rows = await db
    .select({
      id: stagingVenues.id,
      name: stagingVenues.name,
      voteCount: stagingVenues.voteCount,
      processedAt: stagingVenues.processedAt,
    })
    .from(stagingVenues)
    .orderBy(desc(stagingVenues.voteCount), desc(stagingVenues.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    voteCount: row.voteCount,
    processed: row.processedAt != null,
  }));
}

/**
 * Insert one staging suggestion (R6 write path). Called by /api/staging AFTER
 * Turnstile + the 5/day KV limit pass. The submitter auto-counts as the first
 * +1 (PRD 提交即首票): the venue starts at `vote_count = 1` and a matching
 * `staging_votes` row is written in the SAME D1 batch (atomic — tally never
 * drifts from its rows, and the submitter can't +1 their own suggestion again).
 * Returns the client DTO so the form can optimistically prepend it.
 */
export async function insertStagingVenue(
  db: Db,
  row: NewStagingVenueRow,
): Promise<StagingVenueDto> {
  await db.batch([
    db.insert(stagingVenues).values({ ...row, voteCount: 1 }),
    db.insert(stagingVotes).values({
      id: newId(),
      venueId: row.id,
      ipHash: row.ipHash,
      createdAt: row.createdAt,
    }),
  ]);
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    processed: row.processedAt != null,
    voteCount: 1,
    votedByMe: true,
  };
}

/** Outcome of an {@link addVote} attempt — mapped to HTTP by the endpoint. */
export type VoteOutcome =
  | { status: "ok"; voteCount: number }
  | { status: "duplicate"; voteCount: number }
  | { status: "rate_limited" }
  | { status: "not_found" };

/** Start of the UTC day containing `now`, as epoch ms (daily-limit window). */
function startOfUtcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Count how many DIFFERENT venues this ip_hash has +1'd today (UTC). Backs the
 * "5 different venues/day" cap. A repeat +1 on the same venue can't inflate this
 * (COUNT DISTINCT), and the submitter's auto-vote is a row too, so submitting
 * also consumes a distinct-venue slot (uniform rule, PRD decision).
 */
export async function countDistinctVotesToday(
  db: Db,
  ipHash: string,
  now: number = Date.now(),
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(distinct ${stagingVotes.venueId})` })
    .from(stagingVotes)
    .where(
      and(
        eq(stagingVotes.ipHash, ipHash),
        gte(stagingVotes.createdAt, startOfUtcDay(now)),
      ),
    );
  return rows[0]?.n ?? 0;
}

/**
 * Record a "+1" (附议) on a staging suggestion. Enforces, in order:
 *   1. venue exists                          → `not_found`
 *   2. this ip already +1'd it (permanent)   → `duplicate` (idempotent, no quota)
 *   3. ip already +1'd `dailyLimit` distinct venues today → `rate_limited`
 *   4. otherwise insert the vote + bump `vote_count` atomically → `ok`
 * The `UNIQUE(venue_id, ip_hash)` index is the race backstop: a concurrent
 * duplicate that slips past step 2 fails the batch (rolled back) and is reported
 * as `duplicate`. No Turnstile — abuse is bounded by dedup + the daily cap.
 */
export async function addVote(
  db: Db,
  venueId: string,
  ipHash: string,
  dailyLimit: number,
  now: number = Date.now(),
): Promise<VoteOutcome> {
  const venue = (
    await db
      .select({ voteCount: stagingVenues.voteCount })
      .from(stagingVenues)
      .where(eq(stagingVenues.id, venueId))
      .limit(1)
  )[0];
  if (!venue) return { status: "not_found" };

  const existing = await db
    .select({ id: stagingVotes.id })
    .from(stagingVotes)
    .where(
      and(eq(stagingVotes.venueId, venueId), eq(stagingVotes.ipHash, ipHash)),
    )
    .limit(1);
  if (existing[0]) return { status: "duplicate", voteCount: venue.voteCount };

  if ((await countDistinctVotesToday(db, ipHash, now)) >= dailyLimit) {
    return { status: "rate_limited" };
  }

  try {
    await db.batch([
      db
        .insert(stagingVotes)
        .values({ id: newId(), venueId, ipHash, createdAt: now }),
      db
        .update(stagingVenues)
        .set({ voteCount: sql`${stagingVenues.voteCount} + 1` })
        .where(eq(stagingVenues.id, venueId)),
    ]);
  } catch (err) {
    // Only a UNIQUE collision (concurrent duplicate) is idempotent; re-throw any
    // real D1 failure so the endpoint surfaces it as a 5xx rather than a fake +1.
    if (!String(err).includes("UNIQUE")) throw err;
    const fresh = (
      await db
        .select({ voteCount: stagingVenues.voteCount })
        .from(stagingVenues)
        .where(eq(stagingVenues.id, venueId))
        .limit(1)
    )[0];
    return {
      status: "duplicate",
      voteCount: fresh?.voteCount ?? venue.voteCount,
    };
  }

  return { status: "ok", voteCount: venue.voteCount + 1 };
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

// D1 queries for the anonymous venue rating (task 06-10-giscus).
//
// Mirrors src/server/staging.ts in shape: a read helper (the SSR summary) and
// a write helper (UPSERT one rating + keep the denormalized aggregate in the
// SAME atomic `db.batch`). The rated venue id is STATIC metadata
// (data/venues/*.json, ADR-1) and is validated by the API route against the
// bundled set — D1 never stores venues, only ratings.
//
// Consistency model (why every write is one batch):
//   • new rating  → INSERT rating row + agg upsert (count+1, sum+score). A
//     concurrent duplicate fails the rating row's UNIQUE index, which rolls
//     the whole batch back (agg never drifts) — same backstop as
//     staging.addVote.
//   • score change → the agg statement derives the OLD score from the rating
//     row itself via a subquery INSIDE the batch (never from a pre-read that
//     could be stale by write time — same "no stale pre-read" rule as the
//     photo-corrections approve path), then the row update overwrites it.
// `ip_hash` is the salted hash (server/ip.ts), never the raw IP, and is never
// sent to the client.

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import type { VenueRatingSummaryDto } from "@/lib/venue-rating";
import { newId } from "@/server/id";
import { venueRatingAgg, venueRatings } from "@/server/db/schema";

/** Outcome of a {@link rateVenue} attempt — mapped to HTTP by the endpoint. */
export type RateVenueOutcome = {
  /** `created` consumes daily quota; `updated`/`unchanged` do not. */
  status: "created" | "updated" | "unchanged";
  ratingCount: number;
  ratingSum: number;
};

/**
 * Read the display aggregate (1 indexed row — NEVER an AVG over the rating
 * rows) plus, when the viewer's ip_hash is known, their own current score so
 * the star control can render the "you rated N" state.
 */
export async function getRatingSummary(
  db: Db,
  venueId: string,
  viewerIpHash?: string,
): Promise<VenueRatingSummaryDto> {
  const agg = (
    await db
      .select({
        ratingCount: venueRatingAgg.ratingCount,
        ratingSum: venueRatingAgg.ratingSum,
      })
      .from(venueRatingAgg)
      .where(eq(venueRatingAgg.venueId, venueId))
      .limit(1)
  )[0];

  let yourScore: number | null = null;
  if (viewerIpHash) {
    yourScore = await getViewerScore(db, venueId, viewerIpHash);
  }

  return {
    count: agg?.ratingCount ?? 0,
    sum: agg?.ratingSum ?? 0,
    yourScore,
  };
}

/** This viewer's current score for a venue, or null when not rated yet. */
export async function getViewerScore(
  db: Db,
  venueId: string,
  ipHash: string,
): Promise<number | null> {
  const row = (
    await db
      .select({ score: venueRatings.score })
      .from(venueRatings)
      .where(
        and(eq(venueRatings.venueId, venueId), eq(venueRatings.ipHash, ipHash)),
      )
      .limit(1)
  )[0];
  return row?.score ?? null;
}

/** Authoritative post-write aggregate (the response the client reconciles to). */
async function readAgg(
  db: Db,
  venueId: string,
): Promise<{ ratingCount: number; ratingSum: number }> {
  const agg = (
    await db
      .select({
        ratingCount: venueRatingAgg.ratingCount,
        ratingSum: venueRatingAgg.ratingSum,
      })
      .from(venueRatingAgg)
      .where(eq(venueRatingAgg.venueId, venueId))
      .limit(1)
  )[0];
  return { ratingCount: agg?.ratingCount ?? 0, ratingSum: agg?.ratingSum ?? 0 };
}

/**
 * Apply a score CHANGE for an existing (venueId, ipHash) rating. The aggregate
 * statement reads the old score from the rating row itself (subquery) inside
 * the atomic batch, so a concurrent change can never make the tally drift —
 * statements in one batch see a consistent row, and D1 serializes batches.
 * Statement order matters: the agg update must run BEFORE the row update so
 * the subquery still sees the old score.
 */
async function applyScoreChange(
  db: Db,
  venueId: string,
  ipHash: string,
  score: number,
  now: number,
): Promise<void> {
  const oldScore = sql`(select ${venueRatings.score} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  await db.batch([
    db
      .update(venueRatingAgg)
      .set({
        ratingSum: sql`${venueRatingAgg.ratingSum} + ${score} - ${oldScore}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(venueRatingAgg.venueId, venueId),
          sql`exists (select 1 from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`,
        ),
      ),
    db
      .update(venueRatings)
      .set({ score, updatedAt: now })
      .where(
        and(eq(venueRatings.venueId, venueId), eq(venueRatings.ipHash, ipHash)),
      ),
  ]);
}

/**
 * Record (or change) one viewer's score for a venue:
 *   1. no rating yet → insert + agg(count+1, sum+score) atomically → `created`
 *   2. same score already recorded → idempotent no-op → `unchanged`
 *   3. different score → change row + move agg sum by the delta → `updated`
 * The UNIQUE(venue_id, ip_hash) index is the race backstop for case 1: a
 * concurrent duplicate insert fails the batch (rolled back, agg untouched) and
 * is retried as a score change. Always returns the authoritative aggregate.
 */
export async function rateVenue(
  db: Db,
  venueId: string,
  ipHash: string,
  score: number,
  now: number = Date.now(),
): Promise<RateVenueOutcome> {
  const existing = await getViewerScore(db, venueId, ipHash);

  if (existing === null) {
    try {
      await db.batch([
        db.insert(venueRatings).values({
          id: newId(),
          venueId,
          score,
          ipHash,
          createdAt: now,
        }),
        db
          .insert(venueRatingAgg)
          .values({
            venueId,
            ratingCount: 1,
            ratingSum: score,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: venueRatingAgg.venueId,
            set: {
              ratingCount: sql`${venueRatingAgg.ratingCount} + 1`,
              ratingSum: sql`${venueRatingAgg.ratingSum} + ${score}`,
              updatedAt: now,
            },
          }),
      ]);
      return { status: "created", ...(await readAgg(db, venueId)) };
    } catch (err) {
      // Only a UNIQUE collision (concurrent first rating from the same ip_hash)
      // falls through to the change path; re-throw real D1 failures so the
      // endpoint surfaces a 5xx rather than a fake success.
      if (!String(err).includes("UNIQUE")) throw err;
      const fresh = await getViewerScore(db, venueId, ipHash);
      if (fresh === score) {
        return { status: "unchanged", ...(await readAgg(db, venueId)) };
      }
      await applyScoreChange(db, venueId, ipHash, score, now);
      return { status: "updated", ...(await readAgg(db, venueId)) };
    }
  }

  if (existing === score) {
    return { status: "unchanged", ...(await readAgg(db, venueId)) };
  }

  await applyScoreChange(db, venueId, ipHash, score, now);
  return { status: "updated", ...(await readAgg(db, venueId)) };
}

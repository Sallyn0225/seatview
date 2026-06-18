// D1 queries for anonymous venue rating dimensions.
//
// Public display reads only the denormalized dimensional aggregate. Legacy
// single-score fields remain for rollback/export, but are never fanned out into
// dimension values.

import { and, eq, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Db } from "@/server/db";
import {
  emptyRatingSums,
  isValidRatingScores,
  RATING_DIMENSIONS,
  sameRatingScores,
  type RatingDimensionScores,
  type VenueRatingSummaryDto,
} from "@/lib/venue-rating";
import { newId } from "@/server/id";
import { venueRatingAgg, venueRatings } from "@/server/db/schema";

/** Outcome of a {@link rateVenue} attempt, mapped to HTTP by the endpoint. */
export type RateVenueOutcome = {
  /** `created` consumes daily quota; `updated`/`unchanged` do not. */
  status: "created" | "updated" | "unchanged";
  ratingCount: number;
  ratingSums: RatingDimensionScores;
};

export type ViewerRatingRow = {
  score: number;
  viewScore: number | null;
  soundScore: number | null;
  amenitiesScore: number | null;
  transitScore: number | null;
};

function rowToScores(
  row: ViewerRatingRow | undefined,
): RatingDimensionScores | null {
  if (!row) return null;
  const scores = {
    view: row.viewScore,
    sound: row.soundScore,
    amenities: row.amenitiesScore,
    transit: row.transitScore,
  };
  return isValidRatingScores(scores) ? scores : null;
}

function legacyMeanScore(scores: RatingDimensionScores): number {
  const total = RATING_DIMENSIONS.reduce((sum, d) => sum + scores[d], 0);
  return Math.round(total / RATING_DIMENSIONS.length);
}

// A per-(venue, viewer) scalar subquery: reads ONE rating column's pre-update
// value from inside the same write batch, so a change never relies on a stale
// pre-read (the "no stale pre-read" rule). One helper instead of a hand-copied
// SELECT per column.
function viewerColumn(
  column: AnySQLiteColumn,
  venueId: string,
  ipHash: string,
) {
  return sql`(select ${column} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
}

// agg SET fragment — add each dimension's new score as a fresh contribution.
function aggSumAdd(scores: RatingDimensionScores) {
  return {
    viewRatingSum: sql`${venueRatingAgg.viewRatingSum} + ${scores.view}`,
    soundRatingSum: sql`${venueRatingAgg.soundRatingSum} + ${scores.sound}`,
    amenitiesRatingSum: sql`${venueRatingAgg.amenitiesRatingSum} + ${scores.amenities}`,
    transitRatingSum: sql`${venueRatingAgg.transitRatingSum} + ${scores.transit}`,
  };
}

// agg SET fragment — move each dimension by (new - old) where old is read from
// the rating row inside the batch (subquery), so the tally cannot drift.
function aggSumDelta(
  scores: RatingDimensionScores,
  venueId: string,
  ipHash: string,
) {
  return {
    viewRatingSum: sql`${venueRatingAgg.viewRatingSum} + ${scores.view} - ${viewerColumn(venueRatings.viewScore, venueId, ipHash)}`,
    soundRatingSum: sql`${venueRatingAgg.soundRatingSum} + ${scores.sound} - ${viewerColumn(venueRatings.soundScore, venueId, ipHash)}`,
    amenitiesRatingSum: sql`${venueRatingAgg.amenitiesRatingSum} + ${scores.amenities} - ${viewerColumn(venueRatings.amenitiesScore, venueId, ipHash)}`,
    transitRatingSum: sql`${venueRatingAgg.transitRatingSum} + ${scores.transit} - ${viewerColumn(venueRatings.transitScore, venueId, ipHash)}`,
  };
}

// venue_ratings SET fragment — the dimensional scores plus the rounded legacy
// mean (kept NOT NULL for rollback/export) and the change timestamp.
function rowScoreSet(scores: RatingDimensionScores, now: number) {
  return {
    score: legacyMeanScore(scores),
    viewScore: scores.view,
    soundScore: scores.sound,
    amenitiesScore: scores.amenities,
    transitScore: scores.transit,
    updatedAt: now,
  };
}

/**
 * This viewer's rating row (legacy or dimensional), or undefined when absent.
 * The endpoint reads it ONCE to gate the daily cap, then hands it to
 * {@link rateVenue} so the write path does not re-read the same row.
 */
export async function getViewerRatingRow(
  db: Db,
  venueId: string,
  ipHash: string,
): Promise<ViewerRatingRow | undefined> {
  return (
    await db
      .select({
        score: venueRatings.score,
        viewScore: venueRatings.viewScore,
        soundScore: venueRatings.soundScore,
        amenitiesScore: venueRatings.amenitiesScore,
        transitScore: venueRatings.transitScore,
      })
      .from(venueRatings)
      .where(
        and(eq(venueRatings.venueId, venueId), eq(venueRatings.ipHash, ipHash)),
      )
      .limit(1)
  )[0];
}

/** This viewer's complete dimensional score set, or null when absent/legacy. */
export async function getViewerScores(
  db: Db,
  venueId: string,
  ipHash: string,
): Promise<RatingDimensionScores | null> {
  return rowToScores(await getViewerRatingRow(db, venueId, ipHash));
}

/**
 * Read the display aggregate (1 indexed row, never an AVG over rating rows)
 * plus, when the viewer's ip_hash is known, their own complete dimension scores.
 */
export async function getRatingSummary(
  db: Db,
  venueId: string,
  viewerIpHash?: string,
): Promise<VenueRatingSummaryDto> {
  const agg = (
    await db
      .select({
        ratingCount: venueRatingAgg.dimensionRatingCount,
        viewRatingSum: venueRatingAgg.viewRatingSum,
        soundRatingSum: venueRatingAgg.soundRatingSum,
        amenitiesRatingSum: venueRatingAgg.amenitiesRatingSum,
        transitRatingSum: venueRatingAgg.transitRatingSum,
      })
      .from(venueRatingAgg)
      .where(eq(venueRatingAgg.venueId, venueId))
      .limit(1)
  )[0];

  let yourScores: RatingDimensionScores | null = null;
  if (viewerIpHash) {
    yourScores = await getViewerScores(db, venueId, viewerIpHash);
  }

  return {
    count: agg?.ratingCount ?? 0,
    sums: agg
      ? {
          view: agg.viewRatingSum,
          sound: agg.soundRatingSum,
          amenities: agg.amenitiesRatingSum,
          transit: agg.transitRatingSum,
        }
      : emptyRatingSums(),
    yourScores,
  };
}

/** Authoritative post-write aggregate for response reconciliation. */
async function readAgg(
  db: Db,
  venueId: string,
): Promise<{ ratingCount: number; ratingSums: RatingDimensionScores }> {
  const summary = await getRatingSummary(db, venueId);
  return { ratingCount: summary.count, ratingSums: summary.sums };
}

const hasCompleteDimensionScores = sql`
  ${venueRatings.viewScore} is not null and
  ${venueRatings.soundScore} is not null and
  ${venueRatings.amenitiesScore} is not null and
  ${venueRatings.transitScore} is not null
`;

async function applyDimensionChange(
  db: Db,
  venueId: string,
  ipHash: string,
  scores: RatingDimensionScores,
  now: number,
): Promise<void> {
  const oldScore = viewerColumn(venueRatings.score, venueId, ipHash);
  const score = legacyMeanScore(scores);

  await db.batch([
    db
      .update(venueRatingAgg)
      .set({
        ratingSum: sql`${venueRatingAgg.ratingSum} + ${score} - ${oldScore}`,
        ...aggSumDelta(scores, venueId, ipHash),
        updatedAt: now,
      })
      .where(
        and(
          eq(venueRatingAgg.venueId, venueId),
          sql`exists (select 1 from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash} and ${hasCompleteDimensionScores})`,
        ),
      ),
    db
      .update(venueRatings)
      .set(rowScoreSet(scores, now))
      .where(
        and(eq(venueRatings.venueId, venueId), eq(venueRatings.ipHash, ipHash)),
      ),
  ]);
}

async function completeLegacyRating(
  db: Db,
  venueId: string,
  ipHash: string,
  scores: RatingDimensionScores,
  now: number,
): Promise<boolean> {
  const oldScore = viewerColumn(venueRatings.score, venueId, ipHash);
  const score = legacyMeanScore(scores);

  const [updatedAgg, updatedRating] = await db.batch([
    db
      .update(venueRatingAgg)
      .set({
        ratingSum: sql`${venueRatingAgg.ratingSum} + ${score} - ${oldScore}`,
        dimensionRatingCount: sql`${venueRatingAgg.dimensionRatingCount} + 1`,
        ...aggSumAdd(scores),
        updatedAt: now,
      })
      .where(
        and(
          eq(venueRatingAgg.venueId, venueId),
          sql`exists (select 1 from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash} and not (${hasCompleteDimensionScores}))`,
        ),
      )
      .returning({ venueId: venueRatingAgg.venueId }),
    db
      .update(venueRatings)
      .set(rowScoreSet(scores, now))
      .where(
        and(
          eq(venueRatings.venueId, venueId),
          eq(venueRatings.ipHash, ipHash),
          sql`not (${hasCompleteDimensionScores})`,
          sql`exists (select 1 from ${venueRatingAgg} where ${venueRatingAgg.venueId} = ${venueId})`,
        ),
      )
      .returning({ id: venueRatings.id }),
  ]);

  return updatedAgg.length > 0 && updatedRating.length > 0;
}

async function completeLegacyOrApplyFreshChange(
  db: Db,
  venueId: string,
  ipHash: string,
  scores: RatingDimensionScores,
  now: number,
): Promise<"updated" | "unchanged"> {
  if (await completeLegacyRating(db, venueId, ipHash, scores, now)) {
    return "updated";
  }

  const freshScores = await getViewerScores(db, venueId, ipHash);
  if (!freshScores) {
    throw new Error("legacy rating completion lost its guarded write");
  }
  if (sameRatingScores(freshScores, scores)) {
    return "unchanged";
  }

  await applyDimensionChange(db, venueId, ipHash, scores, now);
  return "updated";
}

/**
 * Dispatch for a viewer who ALREADY has a rating row, given their current
 * scores (already read by the caller — no extra round trip). One path shared by
 * the normal change flow and the UNIQUE-collision retry:
 *   • complete dimensional & identical → idempotent no-op (`unchanged`)
 *   • complete dimensional & different → delta change (`updated`)
 *   • legacy (no dimensions)           → complete it / retry (`updated`/`unchanged`)
 */
async function changeExistingRating(
  db: Db,
  venueId: string,
  ipHash: string,
  scores: RatingDimensionScores,
  existingScores: RatingDimensionScores | null,
  now: number,
): Promise<"updated" | "unchanged"> {
  if (existingScores) {
    if (sameRatingScores(existingScores, scores)) return "unchanged";
    await applyDimensionChange(db, venueId, ipHash, scores, now);
    return "updated";
  }
  return completeLegacyOrApplyFreshChange(db, venueId, ipHash, scores, now);
}

/**
 * Record (or change) one viewer's complete four-dimension score set.
 * Existing legacy single-score rows become complete dimension rows and count
 * once in the new dimensional aggregate.
 */
export async function rateVenue(
  db: Db,
  venueId: string,
  ipHash: string,
  scores: RatingDimensionScores,
  options: { now?: number; existingRow?: ViewerRatingRow } = {},
): Promise<RateVenueOutcome> {
  const now = options.now ?? Date.now();
  // The endpoint already read this row to gate the daily cap; reuse it instead
  // of a second SELECT of the same (venue_id, ip_hash). `"existingRow" in opts`
  // distinguishes "caller knows there is no row" from "caller didn't read".
  const existing =
    "existingRow" in options
      ? options.existingRow
      : await getViewerRatingRow(db, venueId, ipHash);
  const existingScores = rowToScores(existing);
  const score = legacyMeanScore(scores);

  if (!existing) {
    try {
      await db.batch([
        db.insert(venueRatings).values({
          id: newId(),
          venueId,
          score,
          viewScore: scores.view,
          soundScore: scores.sound,
          amenitiesScore: scores.amenities,
          transitScore: scores.transit,
          ipHash,
          createdAt: now,
        }),
        db
          .insert(venueRatingAgg)
          .values({
            venueId,
            ratingCount: 1,
            ratingSum: score,
            dimensionRatingCount: 1,
            viewRatingSum: scores.view,
            soundRatingSum: scores.sound,
            amenitiesRatingSum: scores.amenities,
            transitRatingSum: scores.transit,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: venueRatingAgg.venueId,
            set: {
              ratingCount: sql`${venueRatingAgg.ratingCount} + 1`,
              ratingSum: sql`${venueRatingAgg.ratingSum} + ${score}`,
              dimensionRatingCount: sql`${venueRatingAgg.dimensionRatingCount} + 1`,
              ...aggSumAdd(scores),
              updatedAt: now,
            },
          }),
      ]);
      return { status: "created", ...(await readAgg(db, venueId)) };
    } catch (err) {
      // Only a UNIQUE collision (a concurrent first rating from the same
      // ip_hash) falls through to the change path; real D1 failures re-throw.
      if (!String(err).includes("UNIQUE")) throw err;
      const freshScores = await getViewerScores(db, venueId, ipHash);
      const status = await changeExistingRating(
        db,
        venueId,
        ipHash,
        scores,
        freshScores,
        now,
      );
      return { status, ...(await readAgg(db, venueId)) };
    }
  }

  const status = await changeExistingRating(
    db,
    venueId,
    ipHash,
    scores,
    existingScores,
    now,
  );
  return { status, ...(await readAgg(db, venueId)) };
}

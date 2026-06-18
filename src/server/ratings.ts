// D1 queries for anonymous venue rating dimensions.
//
// Public display reads only the denormalized dimensional aggregate. Legacy
// single-score fields remain for rollback/export, but are never fanned out into
// dimension values.

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import {
  emptyRatingSums,
  isValidRatingScores,
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

type ViewerRatingRow = {
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
  return Math.round(
    (scores.view + scores.sound + scores.amenities + scores.transit) / 4,
  );
}

function sameScores(
  left: RatingDimensionScores,
  right: RatingDimensionScores,
): boolean {
  return (
    left.view === right.view &&
    left.sound === right.sound &&
    left.amenities === right.amenities &&
    left.transit === right.transit
  );
}

async function getViewerRatingRow(
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

/** Whether this viewer already has any rating row, legacy or dimensional. */
export async function hasViewerRating(
  db: Db,
  venueId: string,
  ipHash: string,
): Promise<boolean> {
  return (await getViewerRatingRow(db, venueId, ipHash)) !== undefined;
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
  const oldView = sql`(select ${venueRatings.viewScore} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  const oldSound = sql`(select ${venueRatings.soundScore} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  const oldAmenities = sql`(select ${venueRatings.amenitiesScore} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  const oldTransit = sql`(select ${venueRatings.transitScore} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  const oldScore = sql`(select ${venueRatings.score} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  const score = legacyMeanScore(scores);

  await db.batch([
    db
      .update(venueRatingAgg)
      .set({
        ratingSum: sql`${venueRatingAgg.ratingSum} + ${score} - ${oldScore}`,
        viewRatingSum: sql`${venueRatingAgg.viewRatingSum} + ${scores.view} - ${oldView}`,
        soundRatingSum: sql`${venueRatingAgg.soundRatingSum} + ${scores.sound} - ${oldSound}`,
        amenitiesRatingSum: sql`${venueRatingAgg.amenitiesRatingSum} + ${scores.amenities} - ${oldAmenities}`,
        transitRatingSum: sql`${venueRatingAgg.transitRatingSum} + ${scores.transit} - ${oldTransit}`,
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
      .set({
        score,
        viewScore: scores.view,
        soundScore: scores.sound,
        amenitiesScore: scores.amenities,
        transitScore: scores.transit,
        updatedAt: now,
      })
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
  const oldScore = sql`(select ${venueRatings.score} from ${venueRatings} where ${venueRatings.venueId} = ${venueId} and ${venueRatings.ipHash} = ${ipHash})`;
  const score = legacyMeanScore(scores);

  const [updatedAgg, updatedRating] = await db.batch([
    db
      .update(venueRatingAgg)
      .set({
        ratingSum: sql`${venueRatingAgg.ratingSum} + ${score} - ${oldScore}`,
        dimensionRatingCount: sql`${venueRatingAgg.dimensionRatingCount} + 1`,
        viewRatingSum: sql`${venueRatingAgg.viewRatingSum} + ${scores.view}`,
        soundRatingSum: sql`${venueRatingAgg.soundRatingSum} + ${scores.sound}`,
        amenitiesRatingSum: sql`${venueRatingAgg.amenitiesRatingSum} + ${scores.amenities}`,
        transitRatingSum: sql`${venueRatingAgg.transitRatingSum} + ${scores.transit}`,
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
      .set({
        score,
        viewScore: scores.view,
        soundScore: scores.sound,
        amenitiesScore: scores.amenities,
        transitScore: scores.transit,
        updatedAt: now,
      })
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
  if (sameScores(freshScores, scores)) {
    return "unchanged";
  }

  await applyDimensionChange(db, venueId, ipHash, scores, now);
  return "updated";
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
  now: number = Date.now(),
): Promise<RateVenueOutcome> {
  const existing = await getViewerRatingRow(db, venueId, ipHash);
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
              viewRatingSum: sql`${venueRatingAgg.viewRatingSum} + ${scores.view}`,
              soundRatingSum: sql`${venueRatingAgg.soundRatingSum} + ${scores.sound}`,
              amenitiesRatingSum: sql`${venueRatingAgg.amenitiesRatingSum} + ${scores.amenities}`,
              transitRatingSum: sql`${venueRatingAgg.transitRatingSum} + ${scores.transit}`,
              updatedAt: now,
            },
          }),
      ]);
      return { status: "created", ...(await readAgg(db, venueId)) };
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err;
      const freshScores = await getViewerScores(db, venueId, ipHash);
      if (freshScores && sameScores(freshScores, scores)) {
        return { status: "unchanged", ...(await readAgg(db, venueId)) };
      }
      if (freshScores) {
        await applyDimensionChange(db, venueId, ipHash, scores, now);
        return { status: "updated", ...(await readAgg(db, venueId)) };
      } else {
        const status = await completeLegacyOrApplyFreshChange(
          db,
          venueId,
          ipHash,
          scores,
          now,
        );
        return { status, ...(await readAgg(db, venueId)) };
      }
    }
  }

  if (!existingScores) {
    const status = await completeLegacyOrApplyFreshChange(
      db,
      venueId,
      ipHash,
      scores,
      now,
    );
    return { status, ...(await readAgg(db, venueId)) };
  }

  if (sameScores(existingScores, scores)) {
    return { status: "unchanged", ...(await readAgg(db, venueId)) };
  }

  await applyDimensionChange(db, venueId, ipHash, scores, now);
  return { status: "updated", ...(await readAgg(db, venueId)) };
}

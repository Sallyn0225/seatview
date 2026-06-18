// Shared venue-rating contract — the cross-layer source of truth for the
// anonymous venue rating dimensions.
// The rating control (client), the /api/rating route (server) and the D1
// `venue_ratings` / `venue_rating_agg` rows all agree on these names + limits
// here so a field cannot drift between layers (cross-layer-thinking-guide).
//
// Deliberately NO Turnstile field: like the staging "+1" (staging/vote.ts), a
// rating is a single click and abuse is bounded by UNIQUE(venue_id, ip_hash)
// dedup-as-UPSERT + the KV daily cap, not a per-click challenge.

/** Valid score bounds (inclusive). */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_DIMENSIONS = [
  "view",
  "sound",
  "amenities",
  "transit",
] as const;
export type RatingDimension = (typeof RATING_DIMENSIONS)[number];
export type RatingDimensionScores = Record<RatingDimension, number>;

/**
 * Daily cap per IP: at most 10 DIFFERENT venues newly rated per UTC day (KV
 * `rating` scope). Changing an existing score does NOT consume quota — the
 * UPSERT touches the same row, so there is nothing new to flood with.
 */
export const RATING_DAILY_LIMIT = 10;

/** Type guard: an integer score within RATING_MIN..RATING_MAX. */
export function isValidRatingScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Type guard: exactly the four required rating dimensions, all 1..5 ints. */
export function isValidRatingScores(
  value: unknown,
): value is RatingDimensionScores {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== RATING_DIMENSIONS.length) return false;
  return RATING_DIMENSIONS.every((dimension) =>
    isValidRatingScore(value[dimension]),
  );
}

/** POST /api/rating body. */
export interface RatingRequest {
  venueId: string;
  scores: RatingDimensionScores;
}

/**
 * POST /api/rating success body: the authoritative aggregate after the write.
 * Returned for a fresh rating, a score change AND an idempotent same-score
 * repeat, so the client reconciles its optimistic state to this value.
 */
export interface RatingResponse {
  venueId: string;
  ratingCount: number;
  ratingSums: RatingDimensionScores;
  yourScores: RatingDimensionScores;
}

/**
 * Per-viewer rating summary, SSR-injected into the venue page (one agg-row
 * read; PRD: the display path never aggregates over `venue_ratings`).
 */
export interface VenueRatingSummaryDto {
  /** How many different IPs rated this venue. */
  count: number;
  /** Sum of each dimension (avg = sums[dimension] / count). */
  sums: RatingDimensionScores;
  /** THIS viewer's current dimension scores, null when not rated yet. */
  yourScores: RatingDimensionScores | null;
}

/**
 * Stable machine error codes returned as `{ error: <code> }`. The CLIENT maps
 * these to localized inline copy (R9) — the API never sends prose.
 */
export type RatingErrorCode =
  | "missing_fields"
  | "venue_not_found"
  | "rate_limited_daily" // RATING_DAILY_LIMIT new venues rated today
  | "database_unavailable"
  | "server_misconfigured"
  | "server_error";

/**
 * Average score rounded to one decimal, or null when nobody rated yet (callers
 * render their zero state instead of a fake 0.0).
 */
export function ratingAverage(count: number, sum: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export function emptyRatingSums(): RatingDimensionScores {
  return {
    view: 0,
    sound: 0,
    amenities: 0,
    transit: 0,
  };
}

export function ratingDimensionAverage(
  count: number,
  sums: RatingDimensionScores,
  dimension: RatingDimension,
): number | null {
  return ratingAverage(count, sums[dimension]);
}

export function ratingOverallAverage(
  summary: VenueRatingSummaryDto,
): number | null {
  if (summary.count <= 0) return null;
  const total = RATING_DIMENSIONS.reduce(
    (sum, dimension) => sum + summary.sums[dimension],
    0,
  );
  return ratingAverage(summary.count * RATING_DIMENSIONS.length, total);
}

/**
 * Pure optimistic-apply for the rating control: the same transition the server
 * performs in D1 (new rating → count+1, sum+score; score change → count stays,
 * sum moves by the delta; same score → no-op). Keeping this in the shared
 * contract means the client's optimistic state can never disagree with the
 * server's batch math.
 */
export function applyOptimisticRating(
  summary: VenueRatingSummaryDto,
  scores: RatingDimensionScores,
): VenueRatingSummaryDto {
  if (summary.yourScores === null) {
    return {
      count: summary.count + 1,
      sums: RATING_DIMENSIONS.reduce<RatingDimensionScores>(
        (next, dimension) => {
          next[dimension] = summary.sums[dimension] + scores[dimension];
          return next;
        },
        emptyRatingSums(),
      ),
      yourScores: { ...scores },
    };
  }
  const unchanged = RATING_DIMENSIONS.every(
    (dimension) => summary.yourScores?.[dimension] === scores[dimension],
  );
  if (unchanged) return summary;
  return {
    count: summary.count,
    sums: RATING_DIMENSIONS.reduce<RatingDimensionScores>((next, dimension) => {
      next[dimension] =
        summary.sums[dimension] -
        (summary.yourScores?.[dimension] ?? 0) +
        scores[dimension];
      return next;
    }, emptyRatingSums()),
    yourScores: { ...scores },
  };
}

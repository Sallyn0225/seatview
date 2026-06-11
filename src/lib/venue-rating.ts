// Shared venue-rating contract — the cross-layer source of truth for the
// anonymous 1..5-star venue rating (task 06-10-giscus, prd "评分后端").
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

/** POST /api/rating body. */
export interface RatingRequest {
  venueId: string;
  score: number;
}

/**
 * POST /api/rating success body: the authoritative aggregate after the write.
 * Returned for a fresh rating, a score change AND an idempotent same-score
 * repeat, so the client reconciles its optimistic state to this value.
 */
export interface RatingResponse {
  venueId: string;
  ratingCount: number;
  ratingSum: number;
  yourScore: number;
}

/**
 * Per-viewer rating summary, SSR-injected into the venue page (one agg-row
 * read; PRD: the display path never aggregates over `venue_ratings`).
 */
export interface VenueRatingSummaryDto {
  /** How many different IPs rated this venue. */
  count: number;
  /** Sum of all scores (avg = sum / count). */
  sum: number;
  /** THIS viewer's current score (by ip_hash), null when not rated yet. */
  yourScore: number | null;
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

/**
 * Pure optimistic-apply for the rating control: the same transition the server
 * performs in D1 (new rating → count+1, sum+score; score change → count stays,
 * sum moves by the delta; same score → no-op). Keeping this in the shared
 * contract means the client's optimistic state can never disagree with the
 * server's batch math.
 */
export function applyOptimisticRating(
  summary: VenueRatingSummaryDto,
  score: number,
): VenueRatingSummaryDto {
  if (summary.yourScore === null) {
    return {
      count: summary.count + 1,
      sum: summary.sum + score,
      yourScore: score,
    };
  }
  if (summary.yourScore === score) return summary;
  return {
    count: summary.count,
    sum: summary.sum - summary.yourScore + score,
    yourScore: score,
  };
}

// Browser-side rating transport (task 06-10-giscus). One call, mirroring
// staging-client.ts `plusOneStaging`: POST /api/rating, NOT retried (a 4xx is
// a real rejection: invalid input or the daily cap). User-facing prose stays
// in i18n; the API returns stable codes which the rating control maps to
// localized inline copy (R9).

import type {
  RatingDimensionScores,
  RatingErrorCode,
  RatingRequest,
  RatingResponse,
} from "@/lib/venue-rating";
import { TransportError, parseErrorCode } from "@/lib/transport";

/** A typed transport failure the rating control maps to localized copy. */
export class RatingError extends TransportError<RatingErrorCode> {
  constructor(code: RatingErrorCode | "network", status?: number) {
    super(code, status);
    this.name = "RatingError";
  }
}

/**
 * Submit (or change) this viewer's score for a venue. Resolves with the
 * authoritative aggregate so the caller can reconcile its optimistic state.
 */
export async function submitRating(
  venueId: string,
  scores: RatingDimensionScores,
  signal?: AbortSignal,
): Promise<RatingResponse> {
  const body: RatingRequest = { venueId, scores };
  let res: Response;
  try {
    res = await fetch("/api/rating", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new RatingError("network");
  }
  if (!res.ok) {
    throw new RatingError(
      await parseErrorCode<RatingErrorCode>(res),
      res.status,
    );
  }
  return (await res.json()) as RatingResponse;
}

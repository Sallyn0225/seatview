import { SEAT_LABEL_MAX } from "@/lib/upload";

/** Max requested seat-label length. Mirrors upload seat labels. */
export const PHOTO_CORRECTION_LABEL_MAX = SEAT_LABEL_MAX;

/** Daily correction-request cap per IP. */
export const PHOTO_CORRECTION_DAILY_LIMIT = 5;

/** POST /api/photo-corrections body. */
export interface PhotoCorrectionRequest {
  photoId: string;
  requestedSeatLabel: string;
  turnstileToken: string;
}

/** POST /api/photo-corrections success body. */
export interface PhotoCorrectionResponse {
  id: string;
  duplicate: boolean;
}

/** Stable machine error codes for public correction requests. */
export type PhotoCorrectionErrorCode =
  | "missing_fields"
  | "photo_not_found"
  | "turnstile_failed"
  | "rate_limited_daily"
  | "database_unavailable"
  | "server_misconfigured"
  | "server_error";

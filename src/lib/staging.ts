// Shared staging-area contract — the cross-layer source of truth for the
// "想看的场馆" submission flow (cross-layer-thinking-guide). The staging form
// (client), the /api/staging route (server) and the D1 `staging_venues` row all
// agree on these names + limits here so a field cannot drift between layers.

import type { StagingVenueDto } from "@/server/staging";

/** Max venue-name length (shape-staging §8: ~80 chars). Enforced client + server. */
export const STAGING_NAME_MAX = 80;

/** Daily staging-submission cap per IP (R8.2). */
export const STAGING_DAILY_LIMIT = 5;

/** POST /api/staging body: the free-text name + the Turnstile token. */
export interface StagingRequest {
  name: string;
  turnstileToken: string;
}

/** POST /api/staging success body: the created suggestion, ready to prepend. */
export interface StagingCreateResponse {
  venue: StagingVenueDto;
}

/** GET /api/staging body: a page of suggestions + a hasMore probe. */
export interface StagingListResponse {
  venues: StagingVenueDto[];
  hasMore: boolean;
}

/**
 * Stable machine error codes returned as `{ error: <code> }`. The CLIENT maps
 * these to localized inline copy (the API never sends user-facing prose — i18n
 * stays in one place, R9). Mirrors the upload flow's UploadErrorCode pattern.
 */
export type StagingErrorCode =
  | "missing_name"
  | "turnstile_failed"
  | "rate_limited_daily" // 5/day reached (R8.2)
  | "database_unavailable"
  | "server_misconfigured"
  | "server_error";

export type { StagingVenueDto } from "@/server/staging";

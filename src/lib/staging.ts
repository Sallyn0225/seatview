// Shared staging-area contract — the cross-layer source of truth for the
// "想看的场馆" submission flow (cross-layer-thinking-guide). The staging form
// (client), the /api/staging route (server) and the D1 `staging_venues` row all
// agree on these names + limits here so a field cannot drift between layers.

import type { StagingVenueDto } from "@/server/staging";

/** Max venue-name length (shape-staging §8: ~80 chars). Enforced client + server. */
export const STAGING_NAME_MAX = 80;

/** Daily staging-submission cap per IP (R8.2). */
export const STAGING_DAILY_LIMIT = 5;

/**
 * Cap on the dedup-match corpus (GET /api/staging/names, issue #3). Most-seconded
 * first, so the cap keeps the realistically-duplicated (popular) venues. Bounds
 * the D1 row-read + payload, and stays well under D1's per-query bound-parameter
 * limit (the names query takes none, but the cap also future-proofs the size).
 */
export const STAGING_MATCH_LIMIT = 500;

/**
 * Daily "+1" cap per IP: at most 5 DIFFERENT venues per UTC day. A repeat +1 on
 * a venue already seconded is an idempotent no-op and does NOT consume quota.
 * Distinct-venue counting + permanent dedup live in D1 (`staging_votes`), not the
 * KV rate-limiter, since "5 distinct venues" is inherently relational.
 */
export const PLUSONE_DAILY_LIMIT = 5;

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
 * Lightweight staging row for the dedup-match corpus (issue #3). Carries ONLY
 * the public, viewer-independent columns — no `votedByMe`, no `ip_hash`, no
 * `processed` — so GET /api/staging/names can be cached publicly at the edge.
 */
export interface StagingNameDto {
  id: string;
  name: string;
  voteCount: number;
}

/** GET /api/staging/names body: the capped, public-cacheable match corpus. */
export interface StagingNamesResponse {
  venues: StagingNameDto[];
}

/** POST /api/staging/vote body: which suggestion to +1 (附议). No Turnstile. */
export interface StagingVoteRequest {
  venueId: string;
}

/**
 * POST /api/staging/vote success body: the venue's tally after the +1. Returned
 * for both a fresh vote and an idempotent repeat (the client reconciles its
 * optimistic count to this authoritative value).
 */
export interface StagingVoteResponse {
  venueId: string;
  voteCount: number;
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
  | "rate_limited_plusone" // 5 different venues +1'd today (PLUSONE_DAILY_LIMIT)
  | "venue_not_found" // +1 target suggestion does not exist
  | "database_unavailable"
  | "server_misconfigured"
  | "server_error";

export type { StagingVenueDto } from "@/server/staging";

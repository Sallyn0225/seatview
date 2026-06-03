// Shared maintainer-admin contract — the cross-layer source of truth for the
// `/admin` moderation surface (R7, ADR-11). The admin page (SSR), the admin
// island (client), the `/api/admin/*` routes (server) and the D1 rows all agree
// on these DTO shapes + error codes here so a field cannot drift between layers
// (cross-layer-thinking-guide). Mirrors the shape of src/lib/staging.ts.
//
// NOTE: every `/api/admin/*` route is fronted by Cloudflare Access (ADR-11), so
// these endpoints never see anonymous traffic in production; in local dev a
// mocked `Cf-Access-Authenticated-User-Email` header (DEV_ADMIN_EMAIL) stands in
// for the edge SSO. The page + island carry NO auth of their own — the edge is
// the gate (src/middleware.ts adminGuard).

import type { StagingVenueDto } from "@/server/staging";

/** Default page size for the admin photo list (slightly larger than the public
 *  grid — a maintainer scans more per screen). */
export const ADMIN_PHOTOS_BATCH = 40;

/** Default page size for the admin staging list. */
export const ADMIN_STAGING_BATCH = 50;
/** Default page size for admin photo-correction requests. */
export const ADMIN_PHOTO_CORRECTIONS_BATCH = 40;

/**
 * One photo row as the admin list sees it. The admin UI shows a thumbnail +
 * seat label + venue/sub-map + time. Which surface a row appears on (live
 * moderation vs the recycle bin) is decided by the query (`onlyDeleted`). A
 * purge-locked row can surface in the recycle bin as cleanup-only, so the UI can
 * finish an interrupted permanent delete. `ipHash` is still NEVER sent (privacy
 * — it is an internal abuse-tracking column).
 */
export interface AdminPhotoDto {
  id: string;
  venueId: string;
  subMapId: string;
  imageKey: string;
  seatLabel: string;
  performanceDate: string | null;
  eventName: string | null;
  description: string | null;
  createdAt: number;
  purgeLocked?: boolean;
}

/** GET /api/admin/photos body: a page of photos + a hasMore probe. */
export interface AdminPhotosResponse {
  photos: AdminPhotoDto[];
  hasMore: boolean;
}

/** One venue facet for the admin photo filter: a venue that has at least one
 *  non-deleted photo, plus its live photo count. The venue's display NAME is
 *  resolved client-side from static venue data (ADR-1), so only the slug + count
 *  travel over the wire. `count` is always the NON-deleted tally (the recycle
 *  bin is a separate tab and does not affect it). */
export interface AdminPhotoVenueFacet {
  venueId: string;
  count: number;
}

/** GET /api/admin/photo-venues body: venues that have photos, for the filter
 *  dropdown. Fetched once on panel mount; the client decrements counts
 *  optimistically on delete rather than re-fetching. */
export interface AdminPhotoVenuesResponse {
  venues: AdminPhotoVenueFacet[];
}

/** GET /api/admin/staging body: a page of staging suggestions + hasMore probe. */
export interface AdminStagingResponse {
  /** The admin list keeps the `processed` flag from the public DTO; that is all
   *  it needs to render a toggle. */
  venues: StagingVenueDto[];
  hasMore: boolean;
}

/** One pending seat-label correction request as the admin console sees it. */
export interface AdminPhotoCorrectionDto {
  id: string;
  photoId: string;
  venueId: string;
  subMapId: string;
  imageKey: string;
  currentSeatLabel: string;
  liveSeatLabel: string;
  requestedSeatLabel: string;
  createdAt: number;
}

/** GET /api/admin/photo-corrections body. */
export interface AdminPhotoCorrectionsResponse {
  requests: AdminPhotoCorrectionDto[];
  hasMore: boolean;
}

/**
 * DELETE /api/admin/photos body (issue #29).
 * - `permanent` absent/false → move the photo to the recycle bin: soft-delete in
 *   D1 only, the R2 object is KEPT so it can be restored.
 * - `permanent: true` → 彻底删除: physically remove a recycle-bin D1 row AND purge
 *   the R2 object. Irreversible; reached only from the recycle bin after a
 *   confirm.
 */
export interface AdminDeletePhotoRequest {
  id: string;
  permanent?: boolean;
}

/** PATCH /api/admin/photos body: restore one photo from the recycle bin
 *  (clear `deleted_at`; the R2 object was never purged). */
export interface AdminRestorePhotoRequest {
  id: string;
}

/** PATCH /api/admin/photos body: update a live photo's user-entered seat label
 *  from the maintainer console (issue #44). */
export interface AdminRenamePhotoSeatRequest {
  id: string;
  seatLabel: string;
}

/** Result of a photo delete/restore/rename: echoes the affected id so the client
 *  can drop (delete/purge), move (restore), or update (rename) that row. */
export interface AdminPhotoMutationResponse {
  id: string;
}

/** PATCH /api/admin/staging body: mark a suggestion processed / unprocessed. */
export interface AdminUpdateStagingRequest {
  id: string;
  processed: boolean;
}

/** DELETE /api/admin/staging body: remove a staging suggestion outright. */
export interface AdminDeleteStagingRequest {
  id: string;
}

/** Echo the affected staging id back so the client updates that row. */
export interface AdminStagingMutationResponse {
  id: string;
}

/** PATCH /api/admin/photo-corrections body. */
export interface AdminUpdatePhotoCorrectionRequest {
  id: string;
  action: "approve" | "reject";
}

/** Result of a correction approve/reject action. */
export interface AdminPhotoCorrectionMutationResponse {
  id: string;
}

/**
 * Stable machine error codes returned as `{ error: <code> }`. The CLIENT maps
 * these to localized inline copy (the API never sends user-facing prose, R9).
 * Mirrors the staging / upload flows.
 */
export type AdminErrorCode =
  | "unauthorized" // edge gate failed / no Cf-Access email (defense in depth)
  | "missing_id"
  | "missing_fields"
  | "invalid_seat_label"
  | "not_found"
  | "database_unavailable"
  | "storage_unavailable"
  | "server_error";

export type { AdminPhotoDto as PhotoDtoForAdmin };

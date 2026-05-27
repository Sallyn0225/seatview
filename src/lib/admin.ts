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

/**
 * One photo row as the admin list sees it. Unlike the public `PhotoDto` this
 * keeps the soft-delete state (`deleted`) so a maintainer can tell at a glance
 * which rows are already removed, and includes coordinates only incidentally
 * (the admin UI shows a thumbnail + seat label + venue/sub-map + time). `ipHash`
 * is still NEVER sent (privacy — it is an internal abuse-tracking column).
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
  /** Whether this row is already soft-deleted (ADR-6). */
  deleted: boolean;
}

/** GET /api/admin/photos body: a page of photos + a hasMore probe. */
export interface AdminPhotosResponse {
  photos: AdminPhotoDto[];
  hasMore: boolean;
}

/** One venue facet for the admin photo filter: a venue that has at least one
 *  non-deleted photo, plus its live photo count. The venue's display NAME is
 *  resolved client-side from static venue data (ADR-1), so only the slug + count
 *  travel over the wire. `count` is always the NON-deleted tally (independent of
 *  the list's `includeDeleted` audit toggle). */
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

/** DELETE /api/admin/photos body: which photo to soft-delete (+ purge R2). */
export interface AdminDeletePhotoRequest {
  id: string;
}

/** Result of a photo soft-delete: echoes the id so the client drops that row. */
export interface AdminDeletePhotoResponse {
  id: string;
  /** Whether the R2 object was purged (false → object missing / purge failed;
   *  the D1 soft-delete still succeeded and the row is hidden everywhere). */
  objectPurged: boolean;
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

/**
 * Stable machine error codes returned as `{ error: <code> }`. The CLIENT maps
 * these to localized inline copy (the API never sends user-facing prose, R9).
 * Mirrors the staging / upload flows.
 */
export type AdminErrorCode =
  | "unauthorized" // edge gate failed / no Cf-Access email (defense in depth)
  | "missing_id"
  | "not_found"
  | "database_unavailable"
  | "storage_unavailable"
  | "server_error";

export type { AdminPhotoDto as PhotoDtoForAdmin };

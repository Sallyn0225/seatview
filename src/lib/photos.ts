// Shared photo helpers — the cross-layer contract for user-uploaded seat views.
//
// One source of truth for two things, reused by the seatmap (step 4), the
// photo grid + Lightbox (step 5):
//   1. The wire shape of a photo (`PhotoDto`) sent SSR-injected or over
//      `GET /api/photos`, and the D1-row → DTO mapper.
//   2. `imageKeyToUrl()` — turning a stored R2 object key into a fetchable URL.
//
// Keeping these here (not inside an island) means the seatmap, grid and
// Lightbox all agree on field names + URL strategy (cross-layer-thinking-guide:
// the photo fields stay consistent across SSR, API and client).

import type { Photo } from "@/types";
import type { PhotoRow } from "@/server/db/schema";

/**
 * The serialized photo shape sent to the client (SSR prop or `/api/photos`).
 * Mirrors `Photo` in src/types — kept structurally identical so islands can
 * consume either source with one type. Coordinates are normalized 0..1.
 */
export type PhotoDto = Photo;

/** Live photo counts for one venue, keyed by sub-map id. */
export interface VenuePhotoCountsDto {
  total: number;
  bySubMapId: Record<string, number>;
}

export const PHOTO_COUNT_CHANGE_EVENT = "seatview:photo-count-change";

export interface PhotoCountChangeDetail {
  venueId: string;
  subMapId: string;
  /** Absolute live count for this sub-map. */
  count?: number;
  /** Delta to apply to this sub-map and the venue total. */
  delta?: number;
}

export function dispatchPhotoCountChange(detail: PhotoCountChangeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PhotoCountChangeDetail>(PHOTO_COUNT_CHANGE_EVENT, {
      detail,
    }),
  );
}

/**
 * Map a raw D1 `photos` row to the client DTO. Drops server-only columns
 * (`ip_hash`, `deleted_at`) so they never reach the browser, and renames the
 * snake_case columns to the camelCase domain shape.
 *
 * Callers MUST have already filtered `deleted_at IS NULL` at the query level
 * (ADR-6) — this mapper does not re-check.
 */
export function rowToPhotoDto(row: PhotoRow): PhotoDto {
  return {
    id: row.id,
    venueId: row.venueId,
    subMapId: row.subMapId,
    xPercent: row.xPercent,
    yPercent: row.yPercent,
    imageKey: row.imageKey,
    width: row.width,
    height: row.height,
    seatLabel: row.seatLabel,
    performanceDate: row.performanceDate ?? null,
    eventName: row.eventName ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt,
  };
}

/**
 * Resolve an R2 object key to a fetchable image URL.
 *
 * Strategy (MVP): images are served from R2 public-read at a configurable base
 * URL (`PUBLIC_R2_BASE_URL`, e.g. a custom domain / r2.dev bucket URL). The key
 * is appended verbatim. When the base is absent (local dev, no R2 wired yet)
 * we fall back to a same-origin `/r2/<key>` path so the grid/Lightbox still get
 * a stable, non-throwing URL to render a broken-image placeholder against — the
 * seatmap itself renders annotation pins, not photos, so it does not depend on
 * this resolving to a real asset.
 *
 * `baseUrl` is passed in (read from `PUBLIC_R2_BASE_URL` at the call site) so
 * this stays a pure function usable from SSR, API routes and the client.
 */
export function imageKeyToUrl(key: string, baseUrl?: string): string {
  const trimmedKey = key.replace(/^\/+/, "");
  if (baseUrl && baseUrl.length > 0) {
    return `${baseUrl.replace(/\/+$/, "")}/${trimmedKey}`;
  }
  return `/r2/${trimmedKey}`;
}

// Client-side fetch for sub-map annotation points (browser only).
//
// Used by VenueMain when the user switches sub-map without a reload (R3.3): it
// calls GET /api/photos for the new sub-map and re-renders the seatmap. Kept
// separate from src/lib/photos.ts (which is import-safe on the server) so the
// pure mappers/URL util stay free of any browser/`fetch` assumptions.

import type { PhotoDto } from "@/lib/photos";

interface PhotosResponse {
  photos: PhotoDto[];
}

/**
 * Fetch ALL non-deleted points for a sub-map (no limit) so the seatmap can
 * cluster the complete set. Throws on a non-OK response so the caller can show
 * the error Key State.
 */
export async function fetchSubMapPhotos(
  venueId: string,
  subMapId: string,
  signal?: AbortSignal,
): Promise<PhotoDto[]> {
  const params = new URLSearchParams({ venue: venueId, subMap: subMapId });
  const res = await fetch(`/api/photos?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`fetch photos failed: ${res.status}`);
  }
  const data = (await res.json()) as PhotosResponse;
  return data.photos ?? [];
}

/**
 * Fetch ONE page of photos for the masonry grid (shape-photo-grid.md §5: first
 * batch is SSR, subsequent batches 24 at a time via IntersectionObserver). The
 * grid asks for `limit + 1` rows so it can tell "there is a next page" without a
 * second round-trip — see fetchGridPage which trims the sentinel.
 *
 * Throws on a non-OK response so the caller can run its silent-retry path
 * (shape-photo-grid.md §7: whole-batch failure retries once after 60s, no
 * toast).
 */
export async function fetchSubMapPhotosPage(
  venueId: string,
  subMapId: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<PhotoDto[]> {
  const params = new URLSearchParams({
    venue: venueId,
    subMap: subMapId,
    offset: String(offset),
    limit: String(limit),
  });
  const res = await fetch(`/api/photos?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`fetch photos page failed: ${res.status}`);
  }
  const data = (await res.json()) as PhotosResponse;
  return data.photos ?? [];
}

/**
 * Fetch a grid page and tell the caller whether more pages exist. Over-fetches
 * one extra row (`limit + 1`) as a hasMore probe, then trims it so the returned
 * `photos` is exactly `limit` long. Keeps the "no count query" simplicity while
 * giving the grid a reliable end-of-feed signal (shape-photo-grid.md §6 end
 * state).
 */
export async function fetchGridPage(
  venueId: string,
  subMapId: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{ photos: PhotoDto[]; hasMore: boolean }> {
  const rows = await fetchSubMapPhotosPage(
    venueId,
    subMapId,
    offset,
    limit + 1,
    signal,
  );
  const hasMore = rows.length > limit;
  return { photos: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

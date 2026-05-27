// D1 read queries for photo annotation points.
//
// Every query MUST filter soft-deleted rows (`deleted_at IS NULL`, ADR-6 +
// database-guidelines) so maintainer-removed content disappears everywhere. The
// composite index `idx_photos_venue(venue_id, sub_map_id, deleted_at)` backs
// these lookups.
//
// Read-only: no auth, no rate limit (those guard the write paths in later
// steps). Used by the venue page SSR and `GET /api/photos`.

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { photos, type NewPhotoRow, type PhotoRow } from "@/server/db/schema";
import { rowToPhotoDto, type PhotoDto } from "@/lib/photos";
import type { AdminPhotoDto, AdminPhotoVenueFacet } from "@/lib/admin";

export interface ListPhotosOptions {
  /** Skip this many rows (grid pagination, step 5). */
  offset?: number;
  /** Cap returned rows. Omit to return ALL points (the seatmap needs the full
   *  set to cluster correctly). */
  limit?: number;
}

/**
 * List non-deleted photos for one sub-map, newest first (R3.9 ordering, reused
 * as the seatmap's full annotation set). Returns the client DTO shape with
 * server-only columns stripped.
 */
export async function listSubMapPhotos(
  db: Db,
  venueId: string,
  subMapId: string,
  options: ListPhotosOptions = {},
): Promise<PhotoDto[]> {
  const where = and(
    eq(photos.venueId, venueId),
    eq(photos.subMapId, subMapId),
    isNull(photos.deletedAt),
  );

  const base = db
    .select()
    .from(photos)
    .where(where)
    .orderBy(desc(photos.createdAt));

  // Drizzle's d1 query builder narrows after `.limit()`; branch so the
  // unbounded (full-set) path stays a plain select.
  if (options.limit !== undefined) {
    const rows = await base.limit(options.limit).offset(options.offset ?? 0);
    return rows.map(rowToPhotoDto);
  }

  const rows = await base;
  return rows.map(rowToPhotoDto);
}

/**
 * Insert one uploaded photo annotation row (R4 §8 write path). Called by the
 * upload commit endpoint AFTER the R2 bytes have landed and the HMAC ticket has
 * been verified — every field here comes from the signed ticket / server, never
 * raw from the client body, so the persisted row matches what was authorized.
 *
 * Returns the inserted row's client DTO (server-only columns stripped) so the
 * client can optimistically prepend it to the grid (R3.9, newest first) without
 * a re-fetch.
 *
 * Note: per R11.4 the copyright-consent state is NOT stored — the upload only
 * reaching this point means the box was checked client-side; D1 stays tight.
 */
export async function insertPhoto(db: Db, row: NewPhotoRow): Promise<PhotoDto> {
  await db.insert(photos).values(row);
  return rowToPhotoDto({
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
    ipHash: row.ipHash,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? null,
  });
}

// ── Maintainer admin (R7) ───────────────────────────────────────────────────
// These run ONLY behind the Cloudflare Access edge gate (ADR-11). Unlike the
// public reads (which only ever see live rows), the admin list can also see
// soft-deleted rows — the recycle bin (`onlyDeleted`, issue #29) — so a
// maintainer can restore or permanently delete them. They map to AdminPhotoDto
// (drops the abuse-tracking `ip_hash`).

/** Map a raw `photos` row to the admin DTO (drops the abuse-tracking
 *  `ip_hash`). */
function rowToAdminPhotoDto(row: PhotoRow): AdminPhotoDto {
  return {
    id: row.id,
    venueId: row.venueId,
    subMapId: row.subMapId,
    imageKey: row.imageKey,
    seatLabel: row.seatLabel,
    performanceDate: row.performanceDate ?? null,
    eventName: row.eventName ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt,
  };
}

export interface ListAllPhotosOptions {
  offset?: number;
  limit?: number;
  /** When false (default) only LIVE rows (`deleted_at IS NULL`) are returned —
   *  the photos moderation view. When true ONLY soft-deleted rows
   *  (`deleted_at IS NOT NULL`) are returned — the recycle bin (issue #29). */
  onlyDeleted?: boolean;
  /** Restrict to one venue (issue #28 admin filter). Omit for all venues. */
  venueId?: string;
}

/**
 * List photos for the admin surface, newest-first, across ALL venues/sub-maps.
 * Defaults to LIVE rows (the photos moderation view); pass `onlyDeleted` to list
 * the recycle bin instead (soft-deleted rows whose R2 object is still intact and
 * thus restorable, issue #29). Pass `venueId` to restrict to one venue (the admin
 * venue filter — composes with the live view).
 */
export async function listAllPhotosForAdmin(
  db: Db,
  options: ListAllPhotosOptions = {},
): Promise<AdminPhotoDto[]> {
  const conditions = [
    options.onlyDeleted
      ? isNotNull(photos.deletedAt)
      : isNull(photos.deletedAt),
    options.venueId ? eq(photos.venueId, options.venueId) : undefined,
  ].filter((c) => c !== undefined);
  const base = db.select().from(photos);
  const filtered =
    conditions.length > 0 ? base.where(and(...conditions)) : base;
  const rows = await filtered
    .orderBy(desc(photos.createdAt))
    .limit(options.limit ?? 40)
    .offset(options.offset ?? 0);
  return rows.map(rowToAdminPhotoDto);
}

/**
 * Per-venue NON-deleted photo counts for the admin filter dropdown (issue #28):
 * one row per venue that currently has ≥1 live photo. Soft-deleted rows are
 * excluded so the count matches the live moderation view (the recycle bin is a
 * separate tab and does not affect these numbers). Venue display names are
 * resolved client-side from static data (ADR-1) — only slug + count here.
 */
export async function listAdminPhotoVenueFacets(
  db: Db,
): Promise<AdminPhotoVenueFacet[]> {
  const rows = await db
    .select({
      venueId: photos.venueId,
      count: sql<number>`count(*)`,
    })
    .from(photos)
    .where(isNull(photos.deletedAt))
    .groupBy(photos.venueId);
  return rows.map((r) => ({ venueId: r.venueId, count: Number(r.count) }));
}

/**
 * Soft-delete one photo = move it to the recycle bin (ADR-6, revised by issue
 * #29): set `deleted_at` so every public query (`deleted_at IS NULL`)
 * immediately hides it — the seatmap pin and grid card disappear with no
 * "deleted" placeholder. The R2 object is INTENTIONALLY KEPT so the maintainer
 * can restore the photo from the recycle bin; only `purgePhoto` (彻底删除) ever
 * deletes R2 bytes. This function only touches D1.
 *
 * Idempotent: re-deleting an already-deleted row is a no-op write. Returns the
 * `image_key` of the affected row, or `null` when no such row exists.
 */
export async function softDeletePhoto(
  db: Db,
  id: string,
  now: number = Date.now(),
): Promise<string | null> {
  const existing = await db
    .select({ imageKey: photos.imageKey, deletedAt: photos.deletedAt })
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);
  const row = existing[0];
  if (!row) return null;

  if (row.deletedAt == null) {
    await db.update(photos).set({ deletedAt: now }).where(eq(photos.id, id));
  }
  return row.imageKey;
}

/**
 * Restore one photo from the recycle bin (issue #29): clear `deleted_at` so the
 * public queries see it again (the R2 object was never purged, so the image is
 * intact). Idempotent: restoring a live row is a no-op write. Returns the
 * `image_key` of the affected row, or `null` when no such row exists.
 */
export async function restorePhoto(db: Db, id: string): Promise<string | null> {
  const existing = await db
    .select({ imageKey: photos.imageKey })
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);
  const row = existing[0];
  if (!row) return null;

  await db.update(photos).set({ deletedAt: null }).where(eq(photos.id, id));
  return row.imageKey;
}

/**
 * Permanently delete one photo (彻底删除, issue #29): physically remove the D1
 * row. The R2 object is purged SEPARATELY by the API route (it owns the BUCKET
 * binding); this function only touches D1. IRREVERSIBLE — the route reaches here
 * only from the recycle bin after an explicit maintainer confirm.
 *
 * Only recycle-bin rows are eligible: a live row must first move through the
 * reversible delete path. Returns the `image_key` of the removed row (so the
 * route knows which R2 object to purge), or `null` when no such deleted row
 * exists.
 */
export async function hardDeletePhoto(
  db: Db,
  id: string,
): Promise<string | null> {
  const existing = await db
    .select({ imageKey: photos.imageKey })
    .from(photos)
    .where(and(eq(photos.id, id), isNotNull(photos.deletedAt)))
    .limit(1);
  const row = existing[0];
  if (!row) return null;

  await db
    .delete(photos)
    .where(and(eq(photos.id, id), isNotNull(photos.deletedAt)));
  return row.imageKey;
}

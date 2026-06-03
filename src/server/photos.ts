// D1 read queries for photo annotation points.
//
// Every query MUST filter soft-deleted rows (`deleted_at IS NULL`, ADR-6 +
// database-guidelines) so maintainer-removed content disappears everywhere. The
// composite index `idx_photos_venue(venue_id, sub_map_id, deleted_at)` backs
// these lookups.
//
// Read-only: no auth, no rate limit (those guard the write paths in later
// steps). Used by the venue page SSR and `GET /api/photos`.

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { photos, type NewPhotoRow, type PhotoRow } from "@/server/db/schema";
import { rowToPhotoDto, type PhotoDto } from "@/lib/photos";
import type { AdminPhotoDto, AdminPhotoVenueFacet } from "@/lib/admin";

/**
 * Internal tombstone used while a permanent delete is purging R2. Epoch-ms
 * `deleted_at` values are always positive, so this sentinel is excluded from
 * restore eligibility while remaining visible as a cleanup-only recycle-bin row.
 */
const PHOTO_PURGE_STARTED_DELETED_AT = -1;

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
// soft-deleted rows — the recycle bin (`onlyDeleted`, issue #29) — plus
// cleanup-only purge locks, so a maintainer can restore or permanently delete
// eligible rows and finish interrupted purges. They map to AdminPhotoDto (drops
// the abuse-tracking `ip_hash`).

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
    purgeLocked: row.deletedAt === PHOTO_PURGE_STARTED_DELETED_AT,
  };
}

export interface ListAllPhotosOptions {
  offset?: number;
  limit?: number;
  /** When false (default) only LIVE rows (`deleted_at IS NULL`) are returned —
   *  the photos moderation view. When true deleted rows are returned — the
   *  recycle bin (issue #29), including cleanup-only purge locks. */
  onlyDeleted?: boolean;
  /** Restrict to one venue (issue #28 admin filter). Omit for all venues. */
  venueId?: string;
}

/**
 * List photos for the admin surface, newest-first, across ALL venues/sub-maps.
 * Defaults to LIVE rows (the photos moderation view); pass `onlyDeleted` to list
 * the recycle bin instead (soft-deleted rows plus cleanup-only purge locks,
 * issue #29). Pass `venueId` to restrict to one venue (the admin venue filter —
 * composes with the live view).
 */
export async function listAllPhotosForAdmin(
  db: Db,
  options: ListAllPhotosOptions = {},
): Promise<AdminPhotoDto[]> {
  const conditions = [
    options.onlyDeleted
      ? or(
          gt(photos.deletedAt, 0),
          eq(photos.deletedAt, PHOTO_PURGE_STARTED_DELETED_AT),
        )
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
 * Update the user-entered seat label for one LIVE photo from the maintainer
 * admin list (issue #44). Recycle-bin rows are intentionally not renamed here:
 * the visible moderation surface edits content currently exposed publicly.
 */
export async function updatePhotoSeatLabelForAdmin(
  db: Db,
  id: string,
  seatLabel: string,
): Promise<boolean> {
  const updated = await db
    .update(photos)
    .set({ seatLabel })
    .where(and(eq(photos.id, id), isNull(photos.deletedAt)))
    .returning({ id: photos.id });
  return updated.length > 0;
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
 * public queries see it again. Only recycle-bin rows are eligible; the API route
 * verifies the R2 object still exists before calling this so legacy rows with
 * purged objects cannot be exposed. Returns the `image_key` of the affected row,
 * or `null` when no such deleted row exists.
 */
export async function restorePhoto(db: Db, id: string): Promise<string | null> {
  const restored = await db
    .update(photos)
    .set({ deletedAt: null })
    .where(and(eq(photos.id, id), gt(photos.deletedAt, 0)))
    .returning({ imageKey: photos.imageKey });
  return restored[0]?.imageKey ?? null;
}

/**
 * Look up the R2 key for a recycle-bin photo before a storage operation. The
 * D1 row stays in place until the caller confirms the R2 operation succeeded.
 */
export async function getDeletedPhotoImageKey(
  db: Db,
  id: string,
): Promise<string | null> {
  const existing = await db
    .select({ imageKey: photos.imageKey })
    .from(photos)
    .where(and(eq(photos.id, id), gt(photos.deletedAt, 0)))
    .limit(1);
  return existing[0]?.imageKey ?? null;
}

/**
 * Atomically reserve a recycle-bin row for permanent deletion. After this
 * succeeds, concurrent restores can no longer clear `deleted_at`, even if they
 * already read the image key before the R2 purge starts.
 *
 * Existing purge-lock rows are returned as cleanup-only claims so a previous
 * interrupted permanent-delete can be retried from the admin recycle bin.
 */
export interface PhotoPurgeClaim {
  imageKey: string;
  alreadyLocked: boolean;
  /** The row's original positive `deleted_at` captured just before the claim
   *  overwrote it with the sentinel, so a released claim can restore the real
   *  recycle-bin time instead of "now". `null` for an already-locked row (its
   *  original time was lost by the prior interrupted purge) or when unknown. */
  previousDeletedAt: number | null;
}

export async function claimPhotoForPurge(
  db: Db,
  id: string,
): Promise<PhotoPurgeClaim | null> {
  // Snapshot the current deletion time before the claim below overwrites it with
  // the sentinel, so a released claim can restore the ORIGINAL recycle-bin time.
  // The atomic UPDATE (not this read) is still the claim gate.
  const snapshot = await db
    .select({ deletedAt: photos.deletedAt })
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);
  const snapshotDeletedAt = snapshot[0]?.deletedAt ?? null;

  const claimed = await db
    .update(photos)
    .set({ deletedAt: PHOTO_PURGE_STARTED_DELETED_AT })
    .where(and(eq(photos.id, id), gt(photos.deletedAt, 0)))
    .returning({ imageKey: photos.imageKey });
  const newlyClaimed = claimed[0]?.imageKey;
  if (newlyClaimed)
    return {
      imageKey: newlyClaimed,
      alreadyLocked: false,
      previousDeletedAt:
        snapshotDeletedAt !== null && snapshotDeletedAt > 0
          ? snapshotDeletedAt
          : null,
    };

  const existingLock = await db
    .select({ imageKey: photos.imageKey })
    .from(photos)
    .where(
      and(
        eq(photos.id, id),
        eq(photos.deletedAt, PHOTO_PURGE_STARTED_DELETED_AT),
      ),
    )
    .limit(1);
  const lockedImageKey = existingLock[0]?.imageKey;
  return lockedImageKey
    ? { imageKey: lockedImageKey, alreadyLocked: true, previousDeletedAt: null }
    : null;
}

/**
 * Release a purge reservation only when storage is known to still contain the
 * image. Ambiguous/missing storage failures keep the sentinel so restore cannot
 * expose a live row with missing bytes. Restores the row's original recycle-bin
 * timestamp supplied by the caller, falling back to now only when it is unknown.
 */
export async function releasePhotoPurgeClaim(
  db: Db,
  id: string,
  restoredDeletedAt: number = Date.now(),
): Promise<boolean> {
  const released = await db
    .update(photos)
    .set({ deletedAt: restoredDeletedAt })
    .where(
      and(
        eq(photos.id, id),
        eq(photos.deletedAt, PHOTO_PURGE_STARTED_DELETED_AT),
      ),
    )
    .returning({ id: photos.id });
  return released.length > 0;
}

/**
 * Permanently delete one photo row (彻底删除, issue #29): physically remove the D1
 * row after the API route has already claimed the purge and purged the R2
 * object (it owns the BUCKET binding). This function only touches D1.
 * IRREVERSIBLE — the route reaches here only from the recycle bin after an
 * explicit maintainer confirm and successful storage purge.
 *
 * Only purge-claimed rows are eligible: a live/restorable row must first move
 * through `claimPhotoForPurge`. Returns the `image_key` of the removed row, or
 * `null` when no such claimed row exists.
 */
export async function hardDeletePhoto(
  db: Db,
  id: string,
): Promise<string | null> {
  const deleted = await db
    .delete(photos)
    .where(
      and(
        eq(photos.id, id),
        eq(photos.deletedAt, PHOTO_PURGE_STARTED_DELETED_AT),
      ),
    )
    .returning({ imageKey: photos.imageKey });
  return deleted[0]?.imageKey ?? null;
}

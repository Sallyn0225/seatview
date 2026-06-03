import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { newId } from "@/server/id";
import type { AdminPhotoCorrectionDto } from "@/lib/admin";
import {
  photoCorrectionRequests,
  photos,
  type NewPhotoCorrectionRequestRow,
} from "@/server/db/schema";

export interface CreatePhotoCorrectionInput {
  photoId: string;
  requestedSeatLabel: string;
  ipHash: string;
  createdAt?: number;
}

export type CreatePhotoCorrectionOutcome =
  | { status: "created"; id: string }
  | { status: "duplicate"; id: string }
  | { status: "photo_not_found" };

function dedupKey(
  ipHash: string,
  photoId: string,
  requestedSeatLabel: string,
): string {
  return `${ipHash}:${photoId}:${requestedSeatLabel}`;
}

/** Insert one pending correction request, or return the existing pending row. */
export async function createPhotoCorrectionRequest(
  db: Db,
  input: CreatePhotoCorrectionInput,
): Promise<CreatePhotoCorrectionOutcome> {
  const photo = (
    await db
      .select({ id: photos.id, seatLabel: photos.seatLabel })
      .from(photos)
      .where(and(eq(photos.id, input.photoId), isNull(photos.deletedAt)))
      .limit(1)
  )[0];
  if (!photo) return { status: "photo_not_found" };

  const activeDedupKey = dedupKey(
    input.ipHash,
    input.photoId,
    input.requestedSeatLabel,
  );
  const existing = (
    await db
      .select({ id: photoCorrectionRequests.id })
      .from(photoCorrectionRequests)
      .where(eq(photoCorrectionRequests.activeDedupKey, activeDedupKey))
      .limit(1)
  )[0];
  if (existing) return { status: "duplicate", id: existing.id };

  const row: NewPhotoCorrectionRequestRow = {
    id: newId(),
    photoId: input.photoId,
    currentSeatLabel: photo.seatLabel,
    requestedSeatLabel: input.requestedSeatLabel,
    ipHash: input.ipHash,
    activeDedupKey,
    createdAt: input.createdAt ?? Date.now(),
    processedAt: null,
    approvedAt: null,
  };

  try {
    await db.insert(photoCorrectionRequests).values(row);
  } catch (err) {
    if (!String(err).includes("UNIQUE")) throw err;
    const duplicate = (
      await db
        .select({ id: photoCorrectionRequests.id })
        .from(photoCorrectionRequests)
        .where(eq(photoCorrectionRequests.activeDedupKey, activeDedupKey))
        .limit(1)
    )[0];
    if (duplicate) return { status: "duplicate", id: duplicate.id };
    throw err;
  }

  return { status: "created", id: row.id };
}

export interface ListPhotoCorrectionsOptions {
  offset?: number;
  limit?: number;
}

/** List pending correction requests for maintainer review, newest first. */
export async function listPhotoCorrectionsForAdmin(
  db: Db,
  options: ListPhotoCorrectionsOptions = {},
): Promise<AdminPhotoCorrectionDto[]> {
  const rows = await db
    .select({
      id: photoCorrectionRequests.id,
      photoId: photoCorrectionRequests.photoId,
      venueId: photos.venueId,
      subMapId: photos.subMapId,
      imageKey: photos.imageKey,
      currentSeatLabel: photoCorrectionRequests.currentSeatLabel,
      liveSeatLabel: photos.seatLabel,
      requestedSeatLabel: photoCorrectionRequests.requestedSeatLabel,
      createdAt: photoCorrectionRequests.createdAt,
    })
    .from(photoCorrectionRequests)
    .innerJoin(photos, eq(photoCorrectionRequests.photoId, photos.id))
    .where(
      and(
        isNull(photoCorrectionRequests.processedAt),
        isNull(photos.deletedAt),
      ),
    )
    .orderBy(desc(photoCorrectionRequests.createdAt))
    .limit(options.limit ?? 40)
    .offset(options.offset ?? 0);

  return rows;
}

export type HandlePhotoCorrectionOutcome =
  | { status: "approved"; id: string }
  | { status: "rejected"; id: string }
  | { status: "not_found" };

/** Approve one pending request and atomically update the public photo label. */
export async function approvePhotoCorrection(
  db: Db,
  id: string,
  now: number = Date.now(),
): Promise<HandlePhotoCorrectionOutcome> {
  const pendingPhotoId = sql<string>`(
    select ${photoCorrectionRequests.photoId}
    from ${photoCorrectionRequests}
    where ${photoCorrectionRequests.id} = ${id}
      and ${photoCorrectionRequests.processedAt} is null
    limit 1
  )`;
  const pendingSeatLabel = sql<string>`(
    select ${photoCorrectionRequests.requestedSeatLabel}
    from ${photoCorrectionRequests}
    where ${photoCorrectionRequests.id} = ${id}
      and ${photoCorrectionRequests.processedAt} is null
    limit 1
  )`;

  const [updatedPhotos, updatedRequests] = await db.batch([
    db
      .update(photos)
      .set({ seatLabel: pendingSeatLabel })
      .where(
        and(
          eq(photos.id, pendingPhotoId),
          isNull(photos.deletedAt),
          // Guard against stale approvals: only update if the live label
          // still matches the current_seat_label captured at request time.
          sql`exists (
            select 1
            from ${photoCorrectionRequests}
            where ${photoCorrectionRequests.id} = ${id}
              and ${photoCorrectionRequests.currentSeatLabel} = ${photos.seatLabel}
          )`,
        ),
      )
      .returning({ id: photos.id }),
    db
      .update(photoCorrectionRequests)
      .set({
        processedAt: now,
        approvedAt: now,
        activeDedupKey: null,
      })
      .where(
        and(
          eq(photoCorrectionRequests.id, id),
          isNull(photoCorrectionRequests.processedAt),
        ),
      )
      .returning({ id: photoCorrectionRequests.id }),
  ]);
  if (!updatedPhotos[0] || !updatedRequests[0]) return { status: "not_found" };

  return { status: "approved", id };
}

/** Reject one pending request without changing the photo label. */
export async function rejectPhotoCorrection(
  db: Db,
  id: string,
  now: number = Date.now(),
): Promise<HandlePhotoCorrectionOutcome> {
  const updated = await db
    .update(photoCorrectionRequests)
    .set({
      processedAt: now,
      approvedAt: null,
      activeDedupKey: null,
    })
    .where(
      and(
        eq(photoCorrectionRequests.id, id),
        isNull(photoCorrectionRequests.processedAt),
      ),
    )
    .returning({ id: photoCorrectionRequests.id });

  return updated[0]
    ? { status: "rejected", id: updated[0].id }
    : { status: "not_found" };
}

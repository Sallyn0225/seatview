// R2 helpers for seat-view images.
//
// Upload strategy (MVP): the client compresses to a ~500KB WebP (R5) and PUTs
// the bytes to the Worker, which writes them into the BOUND R2 bucket via the
// `BUCKET` binding (src/env.d.ts). We do NOT use S3 presigned URLs here — the
// binding-proxy keeps the D1 write un-forgeable (it happens in the same Worker
// request right after the bytes land) and is fully exercisable on local
// miniflare R2 with no S3 credentials / bucket CORS to configure. ~500KB files
// are far under the 100MB single-request Worker limit, so streaming through the
// Worker is fine for this payload size (the cost concern in the research doc is
// about much larger / higher-volume uploads).
//
// Object deletion on soft-delete (ADR-6) lands in the admin step (step 8).

import type { R2Bucket } from "@cloudflare/workers-types";

/** Stored content type for every uploaded image (R5.3: always WebP). */
export const IMAGE_CONTENT_TYPE = "image/webp";

/** Hard cap on accepted upload bytes — generous over the ~500KB client target
 *  (R5.5) but small enough to reject anything that skipped client compression. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB

/**
 * Build the storage key for an uploaded image (R2 object key). Namespaced by
 * venue so the bucket browses cleanly; the photo id (ulid) makes it unique and
 * lines the key up with the D1 `photos.id`.
 */
export function buildImageKey(venueId: string, photoId: string): string {
  return `venues/${venueId}/${photoId}.webp`;
}

/**
 * Write image bytes to R2 under `key`, tagged as WebP. Overwrites are fine —
 * keys are ulid-unique so a collision means a retry of the same upload.
 */
export async function putImage(
  bucket: R2Bucket,
  key: string,
  bytes: ArrayBuffer,
): Promise<void> {
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: IMAGE_CONTENT_TYPE },
  });
}

/** Delete an image object (used by maintainer permanent-delete, issue #29). */
export async function deleteImage(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}

/** Check whether an image object is still present before exposing its D1 row. */
export async function imageExists(
  bucket: R2Bucket,
  key: string,
): Promise<boolean> {
  return (await bucket.head(key)) !== null;
}

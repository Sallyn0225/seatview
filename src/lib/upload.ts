// Shared upload contract — the cross-layer source of truth for the upload flow
// (cross-layer-thinking-guide). The upload Sheet (client), the sign/commit API
// routes (server) and the D1 `photos` row all agree on these field names and
// shapes here, so a field can't drift between layers.
//
// Field lineage (must stay consistent end-to-end):
//   Sheet form         → SignRequest / commit form fields
//   → signed TicketPayload (server, src/server/upload-ticket.ts)
//   → D1 photos row (src/server/db/schema.ts)
//   → PhotoDto (src/lib/photos.ts) → grid / Lightbox display.
//
// `description` max length mirrors the Sheet's textarea limit (shape Step 3:
// "描述 max 200 字符").

import type { PhotoDto } from "@/lib/photos";

/** Max user-description length (shape Step 3). Enforced client + server. */
export const DESCRIPTION_MAX = 200;
/** Max seat-label length (defensive; free text, R4.3.6). */
export const SEAT_LABEL_MAX = 80;
/** Max event-name length (defensive). */
export const EVENT_NAME_MAX = 120;

/**
 * Upper bound on a stored image edge (px). The client compresses the long edge
 * to 1920 (R5.2); allow a little headroom so an off-by-one from the encoder
 * never trips validation, but reject obviously-bogus dimensions (anti-tamper).
 */
export const IMAGE_MAX_EDGE = 4096;

/** The fields the Sheet collects, before image bytes. Coordinates 0..1.
 *  `width`/`height` are the compressed WebP's intrinsic dimensions (NOT user
 *  input): the Sheet reads them off the compressed image and sends them through
 *  /sign so they get bound into the un-forgeable ticket — the masonry grid +
 *  Lightbox then lay out at the photo's REAL aspect ratio (no crop, no CLS,
 *  shape-photo-grid.md §10). */
export interface UploadFields {
  venueId: string;
  subMapId: string;
  xPercent: number;
  yPercent: number;
  /** Intrinsic pixel width of the compressed WebP. */
  width: number;
  /** Intrinsic pixel height of the compressed WebP. */
  height: number;
  seatLabel: string;
  performanceDate: string | null;
  eventName: string | null;
  description: string | null;
}

/** POST /api/upload/sign body: the fields + the Turnstile token (verified once). */
export interface SignRequest extends UploadFields {
  turnstileToken: string;
}

/** POST /api/upload/sign success body. */
export interface SignResponse {
  /** Opaque HMAC ticket to send back with the bytes (anti-forgery). */
  ticket: string;
  /** R2 object key the bytes will be stored at (informational). */
  imageKey: string;
}

/** POST /api/upload/commit success body: the created photo, ready to prepend. */
export interface CommitResponse {
  photo: PhotoDto;
}

/**
 * Stable machine error codes returned as `{ error: <code> }`. The CLIENT maps
 * these to the localized inline copy in the Sheet (the API never sends
 * user-facing prose — keeps i18n in one place, R9). Grouped by which Sheet step
 * surfaces them.
 */
export type UploadErrorCode =
  // sign step
  | "missing_fields"
  | "turnstile_failed"
  | "rate_limited_daily" // 10/day reached (R8.1)
  | "rate_limited_cooldown" // 30s cooldown (R8.1)
  // commit step
  | "invalid_ticket" // tampered / malformed
  | "ticket_expired"
  | "missing_image"
  | "image_too_large"
  | "bad_content_type"
  // shared infra
  | "database_unavailable"
  | "storage_unavailable"
  | "server_misconfigured"
  | "server_error";

/** Daily upload cap per IP (R8.1). */
export const UPLOAD_DAILY_LIMIT = 10;
/** Single-upload cooldown seconds (R8.1). */
export const UPLOAD_COOLDOWN_S = 30;

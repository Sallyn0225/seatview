// HMAC-signed upload ticket — the anti-forgery seam of the upload flow (R4 §8).
//
// Why a ticket instead of a presigned R2 URL?
// The research doc's presigned-URL approach (aws4fetch + R2 S3 credentials +
// bucket CORS) lets the client PUT straight to R2, but then the client also has
// to tell the Worker "I uploaded, please write D1" — and that second call could
// be forged (fake coordinates, skipped Turnstile, replayed). To keep the D1
// write un-forgeable AND keep it locally testable on miniflare (no real S3
// creds / CORS), we instead:
//
//   1. /api/upload/sign  — AFTER Turnstile + cooldown pass, the Worker mints a
//      ticket: an HMAC(payload) where payload = the FULL set of fields that will
//      be written (venue/subMap/x/y/seat_label/optional fields/ipHash/imageKey/
//      expiry). The client cannot alter any field without invalidating the MAC.
//   2. /api/upload/commit — the client sends the ticket + the compressed WebP
//      bytes. The Worker re-verifies the HMAC, streams the bytes into the bound
//      R2 BUCKET, then inserts the D1 row USING THE FIELDS FROM THE TICKET (not
//      from the request body). So the persisted row is exactly what the signing
//      step authorized.
//
// The HMAC key is derived from a server-only secret (TURNSTILE_SECRET_KEY, which
// is already a deployment secret) so no extra secret to manage for the MVP.

const TICKET_VERSION = "v1";
/** Tickets are short-lived; long enough for compression + retry (ADR-12 ~5s). */
export const TICKET_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * The exact, authorized set of fields the commit step will persist. Coordinates
 * are normalized 0..1 (matches `photos.x_percent` / `y_percent`). Optional
 * fields are normalized to `null` here so the signature is canonical.
 */
export interface TicketPayload {
  venueId: string;
  subMapId: string;
  xPercent: number;
  yPercent: number;
  /** Intrinsic pixel dimensions of the compressed WebP — bound here so the
   *  client cannot tamper with the stored aspect ratio (masonry layout). The
   *  commit step writes these to `photos.width` / `photos.height`. */
  width: number;
  height: number;
  seatLabel: string;
  performanceDate: string | null;
  eventName: string | null;
  description: string | null;
  /** R2 object key the bytes will be written to (server-chosen, ulid-based). */
  imageKey: string;
  /** Photo row id (ulid), chosen at sign time so the key + row id agree. */
  photoId: string;
  /** Hashed client IP (never raw) — persisted to `photos.ip_hash`. */
  ipHash: string;
  /** Expiry epoch ms. */
  exp: number;
}

/** base64url without padding (URL/JSON safe). */
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  // Allocate over a concrete ArrayBuffer so the result is a BufferSource that
  // WebCrypto accepts (not a possibly-shared ArrayBufferLike).
  const buffer = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`upload-ticket:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Mint a signed ticket string: `v1.<b64url(payload)>.<b64url(hmac)>`. The
 * payload is fully recoverable by the commit step (it does not trust the request
 * body for the persisted fields).
 */
export async function signTicket(
  secret: string,
  payload: TicketPayload,
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const body = `${TICKET_VERSION}.${b64url(json)}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  return `${body}.${b64url(sig)}`;
}

export type TicketVerification =
  | { valid: true; payload: TicketPayload }
  | { valid: false; reason: "malformed" | "bad_signature" | "expired" };

/**
 * Verify a ticket and recover its authorized payload. Constant-time-ish equality
 * via WebCrypto verify. Rejects malformed / tampered / expired tickets.
 */
export async function verifyTicket(
  secret: string,
  ticket: string,
  now: number = Date.now(),
): Promise<TicketVerification> {
  const parts = ticket.split(".");
  if (parts.length !== 3 || parts[0] !== TICKET_VERSION) {
    return { valid: false, reason: "malformed" };
  }
  const [, payloadPart, sigPart] = parts as [string, string, string];
  const body = `${TICKET_VERSION}.${payloadPart}`;
  const key = await hmacKey(secret);

  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      key,
      fromB64url(sigPart),
      new TextEncoder().encode(body),
    );
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (!ok) return { valid: false, reason: "bad_signature" };

  let payload: TicketPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(payloadPart)));
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, payload };
}

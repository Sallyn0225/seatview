// POST /api/upload/commit — step 2 of the upload write path (R4 §8).
//
// Body: multipart/form-data with `ticket` (the HMAC ticket from /sign) and
// `image` (the client-compressed WebP blob). The Worker:
//   1. verifies the ticket HMAC + expiry (anti-forgery: tampered/expired → 4xx,
//      which the client must NOT retry per ADR-12);
//   2. validates the bytes (present, ≤ cap, WebP);
//   3. writes the bytes into the bound R2 BUCKET (storage_unavailable on fail);
//   4. inserts the D1 row USING THE TICKET'S authorized fields (never the body);
//   5. increments the IP's daily counter + starts the 30s cooldown (R8.1) —
//      quota is consumed only now, on success.
//
// Returns `{ photo }` (the client DTO) so the Sheet can optimistically prepend
// it to the grid (R3.9, newest first) without a re-fetch. ADR-12: the CLIENT
// retries this call on network / 5xx (R2/D1 transient), reusing the SAME ticket
// (and the same Turnstile token, already consumed at sign time).
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyTicket } from "@/server/upload-ticket";
import { incrementDaily, startCooldown } from "@/server/rate-limit";
import {
  putImage,
  IMAGE_CONTENT_TYPE,
  MAX_UPLOAD_BYTES,
} from "@/server/r2/images";
import { getDb } from "@/server/db";
import { insertPhoto } from "@/server/photos";
import { jsonError } from "@/server/api-helpers";
import { UPLOAD_COOLDOWN_S, type CommitResponse } from "@/lib/upload";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[upload:commit] TURNSTILE_SECRET_KEY missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.BUCKET) {
    console.error("[upload:commit] BUCKET R2 binding missing");
    return jsonError("storage_unavailable", 503);
  }
  if (!env.DB) {
    console.error("[upload:commit] DB binding missing");
    return jsonError("database_unavailable", 503);
  }
  if (!env.RATE_LIMIT) {
    console.error("[upload:commit] RATE_LIMIT KV binding missing");
    return jsonError("server_misconfigured", 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("missing_image", 400);
  }

  const ticketStr = form.get("ticket");
  if (typeof ticketStr !== "string") {
    return jsonError("invalid_ticket", 400);
  }

  // ── Verify the ticket (un-forgeable authorization for the persisted row) ──
  const verified = await verifyTicket(secret, ticketStr);
  if (!verified.valid) {
    // 4xx — client must NOT retry (ADR-12: only network/5xx retry).
    if (verified.reason === "expired") return jsonError("ticket_expired", 410);
    console.warn("[upload:commit] bad ticket", { reason: verified.reason });
    return jsonError("invalid_ticket", 400);
  }
  const t = verified.payload;

  // ── Validate the image bytes ──────────────────────────────────────────────
  // FormData file parts are File on the Workers runtime; guard structurally so
  // we don't depend on a `Blob` global being typed in this context.
  const image = form.get("image");
  if (image === null || typeof image === "string") {
    return jsonError("missing_image", 400);
  }
  if (image.size === 0) return jsonError("missing_image", 400);
  if (image.size > MAX_UPLOAD_BYTES) return jsonError("image_too_large", 413);
  // The client always sends WebP (R5.3). Be lenient: accept missing type (some
  // browsers omit it on Blob) but reject an explicit non-image type.
  if (image.type && image.type !== IMAGE_CONTENT_TYPE) {
    return jsonError("bad_content_type", 415);
  }

  const bytes = await image.arrayBuffer();

  // ── Write R2 (storage), then D1 (record) ──────────────────────────────────
  try {
    await putImage(env.BUCKET, t.imageKey, bytes);
  } catch (err) {
    // 5xx — transient; ADR-12 client retry applies.
    console.error("[upload:commit] R2 put failed", {
      key: t.imageKey,
      err: String(err),
    });
    return jsonError("storage_unavailable", 502);
  }

  const createdAt = Date.now();
  try {
    const db = getDb(env.DB);
    const photo = await insertPhoto(db, {
      id: t.photoId,
      venueId: t.venueId,
      subMapId: t.subMapId,
      xPercent: t.xPercent,
      yPercent: t.yPercent,
      imageKey: t.imageKey,
      width: t.width,
      height: t.height,
      seatLabel: t.seatLabel,
      performanceDate: t.performanceDate,
      eventName: t.eventName,
      description: t.description,
      ipHash: t.ipHash, // hashed at sign time — never the raw IP (prd Data Model)
      createdAt,
      deletedAt: null,
    });

    // Consume quota only after a fully successful upload (R8.1). Best-effort:
    // a counter write failure must not fail an already-persisted upload.
    try {
      await incrementDaily(env.RATE_LIMIT, "upload", t.ipHash);
      await startCooldown(
        env.RATE_LIMIT,
        "upload",
        t.ipHash,
        UPLOAD_COOLDOWN_S,
      );
    } catch (err) {
      console.warn("[upload:commit] rate-limit bookkeeping failed", {
        err: String(err),
      });
    }

    const payload: CommitResponse = { photo };
    return new Response(JSON.stringify(payload), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    // D1 insert failed after R2 write. Best-effort orphan cleanup so a retry
    // (same key) does not leave a dangling object; 5xx → client retries.
    console.error("[upload:commit] D1 insert failed", {
      key: t.imageKey,
      err: String(err),
    });
    try {
      await env.BUCKET.delete(t.imageKey);
    } catch {
      /* leave the orphan; admin cleanup can sweep it */
    }
    return jsonError("database_unavailable", 502);
  }
};

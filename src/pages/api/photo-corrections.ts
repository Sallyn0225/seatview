// /api/photo-corrections — anonymous seat-label correction requests (issue #83).
//
// Mirrors the staging write path: validate cheap fields, verify Turnstile, hash
// IP, check KV daily limit, then insert into D1. The request is only a review
// queue item until a maintainer approves it from /api/admin/photo-corrections.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb } from "@/server/db";
import { clientIp, hashIp } from "@/server/ip";
import { checkDailyLimit, incrementDaily } from "@/server/rate-limit";
import { verifyTurnstile } from "@/server/turnstile";
import { createPhotoCorrectionRequest } from "@/server/photo-corrections";
import {
  PHOTO_CORRECTION_DAILY_LIMIT,
  PHOTO_CORRECTION_LABEL_MAX,
  type PhotoCorrectionErrorCode,
  type PhotoCorrectionRequest,
  type PhotoCorrectionResponse,
} from "@/lib/photo-corrections";

export const prerender = false;

function jsonError(code: PhotoCorrectionErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[photo-corrections] TURNSTILE_SECRET_KEY missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.RATE_LIMIT) {
    console.error("[photo-corrections] RATE_LIMIT KV binding missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.DB) {
    console.error("[photo-corrections] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<PhotoCorrectionRequest>;
  try {
    body = (await request.json()) as Partial<PhotoCorrectionRequest>;
  } catch {
    return jsonError("missing_fields", 400);
  }

  const photoId = typeof body.photoId === "string" ? body.photoId.trim() : "";
  const requestedSeatLabel =
    typeof body.requestedSeatLabel === "string"
      ? body.requestedSeatLabel.trim().slice(0, PHOTO_CORRECTION_LABEL_MAX)
      : "";
  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  if (
    photoId.length === 0 ||
    requestedSeatLabel.length === 0 ||
    turnstileToken.length === 0
  ) {
    return jsonError("missing_fields", 400);
  }

  const ip = clientIp(request);
  const ipHash = await hashIp(ip, secret);

  const turnstile = await verifyTurnstile(secret, turnstileToken, ip);
  if (!turnstile.success) {
    console.warn("[photo-corrections] turnstile failed", {
      ipHash,
      codes: turnstile.errorCodes,
    });
    return jsonError("turnstile_failed", 403);
  }

  const daily = await checkDailyLimit(
    env.RATE_LIMIT,
    "photo_correction",
    ipHash,
    PHOTO_CORRECTION_DAILY_LIMIT,
  );
  if (!daily.allowed) {
    console.warn("[photo-corrections] daily limit hit", {
      ipHash,
      count: daily.count,
    });
    return jsonError("rate_limited_daily", 429);
  }

  try {
    const db = getDb(env.DB);
    const outcome = await createPhotoCorrectionRequest(db, {
      photoId,
      requestedSeatLabel,
      ipHash,
    });

    if (outcome.status === "photo_not_found") {
      return jsonError("photo_not_found", 404);
    }

    if (outcome.status === "created") {
      try {
        await incrementDaily(env.RATE_LIMIT, "photo_correction", ipHash);
      } catch (err) {
        console.warn("[photo-corrections] rate-limit bookkeeping failed", {
          err: String(err),
        });
      }
    }

    const payload: PhotoCorrectionResponse = {
      id: outcome.id,
      duplicate: outcome.status === "duplicate",
    };
    return new Response(JSON.stringify(payload), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[photo-corrections] D1 insert failed", {
      err: String(err),
    });
    return jsonError("database_unavailable", 502);
  }
};

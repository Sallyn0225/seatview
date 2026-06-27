// POST /api/upload/sign — step 1 of the upload write path (R4 §8).
//
// Verifies the Turnstile token (R8.3, two-step: token → server siteverify),
// checks the IP's 30s cooldown + 10/day cap (R8.1, KV, keyed by HASHED ip), and
// if all pass mints an HMAC ticket binding the EXACT fields that the commit step
// will persist. No counters are incremented and no R2/D1 write happens here —
// quota is only consumed on a successful commit (so a failed/abandoned upload
// does not burn the user's 10/day).
//
// Returns `{ ticket, imageKey }` on success, or `{ error: <UploadErrorCode> }`
// with the right status. The client maps the code to localized inline copy.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { newId } from "@/server/id";
import { clientIp, hashIp } from "@/server/ip";
import { verifyTurnstile } from "@/server/turnstile";
import { checkDailyLimit, isCoolingDown } from "@/server/rate-limit";
import { buildImageKey } from "@/server/r2/images";
import { signTicket, TICKET_TTL_MS } from "@/server/upload-ticket";
import { getVenue } from "@/data/venues";
import {
  DESCRIPTION_MAX,
  EVENT_NAME_MAX,
  IMAGE_MAX_EDGE,
  SEAT_LABEL_MAX,
  UPLOAD_DAILY_LIMIT,
  type SignRequest,
  type SignResponse,
  type UploadErrorCode,
} from "@/lib/upload";

export const prerender = false;

function jsonError(code: UploadErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Trim + clamp an optional free-text field; empty → null (no blank rows). */
function optional(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function isNormalized(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** A valid stored image edge: integer 1..IMAGE_MAX_EDGE (anti-tamper). */
function isDimension(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= IMAGE_MAX_EDGE
  );
}

export const POST: APIRoute = async ({ request }) => {
  // Secrets / bindings must exist for the write path. Missing → misconfigured
  // (surfaced distinctly from a transient failure so ops can tell them apart).
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[upload:sign] TURNSTILE_SECRET_KEY missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.RATE_LIMIT) {
    console.error("[upload:sign] RATE_LIMIT KV binding missing");
    return jsonError("server_misconfigured", 503);
  }

  let body: Partial<SignRequest>;
  try {
    body = (await request.json()) as Partial<SignRequest>;
  } catch {
    return jsonError("missing_fields", 400);
  }

  // ── Validate the metadata up front (cheap, before Turnstile/KV) ───────────
  const venueId = typeof body.venueId === "string" ? body.venueId : "";
  const subMapId = typeof body.subMapId === "string" ? body.subMapId : "";
  const seatLabel =
    typeof body.seatLabel === "string" ? body.seatLabel.trim() : "";
  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  const venue = getVenue(venueId);
  const subMapValid = venue?.subMaps.some((s) => s.id === subMapId) ?? false;

  if (
    !venue ||
    !subMapValid ||
    !isNormalized(body.xPercent) ||
    !isNormalized(body.yPercent) ||
    !isDimension(body.width) ||
    !isDimension(body.height) ||
    seatLabel.length === 0 ||
    seatLabel.length > SEAT_LABEL_MAX ||
    turnstileToken.length === 0
  ) {
    return jsonError("missing_fields", 400);
  }

  const ip = clientIp(request);
  const ipHash = await hashIp(ip, secret);

  // ── Turnstile (verify exactly once, here) ─────────────────────────────────
  const turnstile = await verifyTurnstile(secret, turnstileToken, ip);
  if (!turnstile.success) {
    console.warn("[upload:sign] turnstile failed", {
      ipHash,
      codes: turnstile.errorCodes,
    });
    return jsonError("turnstile_failed", 403);
  }

  // ── Rate limit (R8.1): 30s cooldown first, then 10/day. Neither mutates the
  //    daily counter — that increment is the commit step's job, post-success. ─
  if (await isCoolingDown(env.RATE_LIMIT, "upload", ipHash)) {
    console.warn("[upload:sign] cooldown hit", { ipHash });
    return jsonError("rate_limited_cooldown", 429);
  }
  const daily = await checkDailyLimit(
    env.RATE_LIMIT,
    "upload",
    ipHash,
    UPLOAD_DAILY_LIMIT,
  );
  if (!daily.allowed) {
    console.warn("[upload:sign] daily limit hit", {
      ipHash,
      count: daily.count,
    });
    return jsonError("rate_limited_daily", 429);
  }

  // ── Mint the ticket (binds the exact persisted fields) ────────────────────
  const photoId = newId();
  const imageKey = buildImageKey(venueId, photoId);
  const ticket = await signTicket(secret, {
    venueId,
    subMapId,
    xPercent: body.xPercent,
    yPercent: body.yPercent,
    width: body.width,
    height: body.height,
    seatLabel: seatLabel.slice(0, SEAT_LABEL_MAX),
    performanceDate:
      typeof body.performanceDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.performanceDate)
        ? body.performanceDate
        : null,
    eventName: optional(body.eventName, EVENT_NAME_MAX),
    description: optional(body.description, DESCRIPTION_MAX),
    imageKey,
    photoId,
    ipHash,
    exp: Date.now() + TICKET_TTL_MS,
  });

  const payload: SignResponse = { ticket, imageKey };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

// /api/staging — the staging-area write + list endpoint (R6).
//
// POST  record a "想看的场馆" suggestion. Reuses the SAME server utils as the
//   upload write path (code-reuse-thinking-guide): Turnstile siteverify
//   (server/turnstile), the per-IP-hash daily KV limit (server/rate-limit, the
//   `staging` RateScope — 5/day, R8.2), the salted IP hash (server/ip) and the
//   workerd-safe ULID (server/id). Order mirrors /api/upload/sign: validate →
//   Turnstile (verified once) → KV limit (read, then increment only on success
//   so a Turnstile/insert failure does not burn quota) → D1 insert.
//
// GET   list suggestions newest-first (R6.4) for the IntersectionObserver
//   continuation paging — the first batch is SSR-injected by the page, so this
//   only serves offset>0 pages. No auth / no rate limit (public content).
//
// User-facing prose stays in i18n (R9): the API only returns stable error codes.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { newId } from "@/server/id";
import { clientIp, hashIp } from "@/server/ip";
import { verifyTurnstile } from "@/server/turnstile";
import { checkDailyLimit, incrementDaily } from "@/server/rate-limit";
import { getDb } from "@/server/db";
import {
  insertStagingVenue,
  listStagingVenues,
  STAGING_BATCH,
} from "@/server/staging";
import {
  STAGING_DAILY_LIMIT,
  STAGING_NAME_MAX,
  type StagingCreateResponse,
  type StagingErrorCode,
  type StagingListResponse,
  type StagingRequest,
} from "@/lib/staging";

export const prerender = false;

function jsonError(code: StagingErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Parse a non-negative integer query param, or undefined when absent/invalid. */
function parseCount(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export const POST: APIRoute = async ({ request }) => {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[staging] TURNSTILE_SECRET_KEY missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.RATE_LIMIT) {
    console.error("[staging] RATE_LIMIT KV binding missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.DB) {
    console.error("[staging] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<StagingRequest>;
  try {
    body = (await request.json()) as Partial<StagingRequest>;
  } catch {
    return jsonError("missing_name", 400);
  }

  // Trim + clamp the free-text name (R9.5: kept verbatim, only whitespace
  // trimmed + length-capped; no semantic rewrite). Empty after trim → rejected.
  const name =
    typeof body.name === "string"
      ? body.name.trim().slice(0, STAGING_NAME_MAX)
      : "";
  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  if (name.length === 0 || turnstileToken.length === 0) {
    return jsonError("missing_name", 400);
  }

  const ip = clientIp(request);
  const ipHash = await hashIp(ip, secret);

  // ── Turnstile (verify exactly once) ───────────────────────────────────────
  const turnstile = await verifyTurnstile(secret, turnstileToken, ip);
  if (!turnstile.success) {
    console.warn("[staging] turnstile failed", {
      ipHash,
      codes: turnstile.errorCodes,
    });
    return jsonError("turnstile_failed", 403);
  }

  // ── Rate limit (R8.2): 5/day. Read first; the increment happens only after a
  //    successful insert so a failed write does not consume the user's quota. ─
  const daily = await checkDailyLimit(
    env.RATE_LIMIT,
    "staging",
    ipHash,
    STAGING_DAILY_LIMIT,
  );
  if (!daily.allowed) {
    console.warn("[staging] daily limit hit", { ipHash, count: daily.count });
    return jsonError("rate_limited_daily", 429);
  }

  // ── Insert (D1) ───────────────────────────────────────────────────────────
  const createdAt = Date.now();
  try {
    const db = getDb(env.DB);
    const venue = await insertStagingVenue(db, {
      id: newId(),
      name,
      ipHash, // hashed — never the raw IP (prd Data Model)
      createdAt,
      processedAt: null,
    });

    // Consume quota only after a fully successful insert (R8.2). Best-effort:
    // a counter write failure must not fail an already-persisted suggestion.
    try {
      await incrementDaily(env.RATE_LIMIT, "staging", ipHash);
    } catch (err) {
      console.warn("[staging] rate-limit bookkeeping failed", {
        err: String(err),
      });
    }

    const payload: StagingCreateResponse = { venue };
    return new Response(JSON.stringify(payload), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[staging] D1 insert failed", { err: String(err) });
    return jsonError("database_unavailable", 502);
  }
};

export const GET: APIRoute = async ({ request, url }) => {
  if (!env.DB) {
    // Surface as a server error so the client shows its LoadFailure state
    // rather than crashing.
    return jsonError("database_unavailable", 503);
  }

  const offset = parseCount(url.searchParams.get("offset")) ?? 0;
  const limit = parseCount(url.searchParams.get("limit")) ?? STAGING_BATCH;

  try {
    const db = getDb(env.DB);
    // Mark `votedByMe` for continuation rows too, so the +1 button paints
    // disabled for venues this viewer already seconded in a past visit. The
    // secret doubles as the IP-hash salt; absent it we just skip the marking.
    const viewerIpHash = env.TURNSTILE_SECRET_KEY
      ? await hashIp(clientIp(request), env.TURNSTILE_SECRET_KEY)
      : undefined;
    // Over-fetch one row as a hasMore probe (same trick as the photo grid), then
    // trim so `venues` is exactly `limit` long.
    const rows = await listStagingVenues(db, {
      offset,
      limit: limit + 1,
      viewerIpHash,
      excludeProcessed: true, // hide 已收录 from the public wishlist (issue #41)
    });
    const hasMore = rows.length > limit;
    const payload: StagingListResponse = {
      venues: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        // PRIVATE (not public): the per-viewer `votedByMe` flag must never be
        // shared across users at the edge. Short browser cache is still fine —
        // the list only shifts on new submissions / +1s.
        "cache-control": "private, max-age=15",
      },
    });
  } catch (err) {
    console.error("[staging] list query failed", { err: String(err) });
    return jsonError("server_error", 500);
  }
};

// /api/rating — record (or change) an anonymous 1..5-star venue rating.
//
// POST { venueId, score } → 200 { venueId, ratingCount, ratingSum, yourScore }.
// Mirrors /api/staging/vote: NO Turnstile (a single click; a challenge per
// rating would wreck the UX). Abuse is bounded by UNIQUE(venue_id, ip_hash) in
// D1 (a repeat rating is a score CHANGE, never a second row) + a KV daily cap
// on NEW venues rated (RATING_DAILY_LIMIT; changing a score consumes no
// quota, and quota is consumed only AFTER the D1 write succeeds). The salted
// IP hash (server/ip) is the only abuse key; the raw IP is never stored.
// Stable error codes only — i18n lives client side (R9).
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { clientIp, hashIp } from "@/server/ip";
import { getDb } from "@/server/db";
import { getViewerScore, rateVenue } from "@/server/ratings";
import { checkDailyLimit, incrementDaily } from "@/server/rate-limit";
import { getVenue } from "@/data/venues";
import {
  RATING_DAILY_LIMIT,
  isValidRatingScore,
  type RatingErrorCode,
  type RatingRequest,
  type RatingResponse,
} from "@/lib/venue-rating";

export const prerender = false;

function jsonError(code: RatingErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // TURNSTILE_SECRET_KEY doubles as the IP-hash salt (server/ip.ts) — required
  // even though rating skips Turnstile verification itself.
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[rating] TURNSTILE_SECRET_KEY missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.DB) {
    console.error("[rating] DB binding missing");
    return jsonError("database_unavailable", 503);
  }
  if (!env.RATE_LIMIT) {
    console.error("[rating] RATE_LIMIT binding missing");
    return jsonError("server_misconfigured", 503);
  }

  let body: Partial<RatingRequest>;
  try {
    body = (await request.json()) as Partial<RatingRequest>;
  } catch {
    return jsonError("missing_fields", 400);
  }
  const venueId = typeof body.venueId === "string" ? body.venueId.trim() : "";
  if (venueId.length === 0 || !isValidRatingScore(body.score)) {
    return jsonError("missing_fields", 400);
  }
  // Ratings only attach to venues that exist in the static atlas (ADR-1) — D1
  // has no venues table, so the bundled set is the referential check.
  if (!getVenue(venueId)) {
    return jsonError("venue_not_found", 404);
  }
  const score = body.score;

  const ipHash = await hashIp(clientIp(request), secret);

  try {
    const db = getDb(env.DB);

    // The daily cap only guards NEW venues rated today; changing an existing
    // score must keep working even at the cap (it creates nothing new).
    const existing = await getViewerScore(db, venueId, ipHash);
    if (existing === null) {
      const limit = await checkDailyLimit(
        env.RATE_LIMIT,
        "rating",
        ipHash,
        RATING_DAILY_LIMIT,
      );
      if (!limit.allowed) {
        console.warn("[rating] daily limit hit", { ipHash });
        return jsonError("rate_limited_daily", 429);
      }
    }

    const outcome = await rateVenue(db, venueId, ipHash, score);

    // Quota is consumed only after the protected write succeeds (rate-limit
    // contract), and only for a genuinely new rating. Best-effort, matching
    // staging/upload/photo-corrections: a counter write failure must not fail
    // an already-persisted rating (the client would roll back a saved score).
    if (outcome.status === "created") {
      try {
        await incrementDaily(env.RATE_LIMIT, "rating", ipHash);
      } catch (err) {
        console.warn("[rating] rate-limit bookkeeping failed", {
          err: String(err),
        });
      }
    }

    const payload: RatingResponse = {
      venueId,
      ratingCount: outcome.ratingCount,
      ratingSum: outcome.ratingSum,
      yourScore: score,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[rating] rating failed", { err: String(err) });
    return jsonError("database_unavailable", 502);
  }
};

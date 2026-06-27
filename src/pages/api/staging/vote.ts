// /api/staging/vote — record a "+1" (附议) on an existing staging suggestion.
//
// POST { venueId } → 200 { venueId, voteCount }. Unlike /api/staging this does
// NOT run Turnstile (a single click; a challenge per +1 would wreck the UX).
// Abuse is bounded entirely in D1 (server/staging.addVote): permanent per-venue
// dedup via UNIQUE(venue_id, ip_hash) + a 5-different-venues/day cap. A repeat
// +1 on a venue already seconded is an idempotent success (returns the current
// count, consumes no quota). The salted IP hash (server/ip) is the only abuse
// key; the raw IP is never stored. Stable error codes only — i18n lives client
// side (R9), mirroring /api/staging.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { clientIp, hashIp } from "@/server/ip";
import { getDb } from "@/server/db";
import { addVote } from "@/server/staging";
import { jsonError } from "@/server/api-helpers";
import {
  PLUSONE_DAILY_LIMIT,
  type StagingVoteRequest,
  type StagingVoteResponse,
} from "@/lib/staging";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // TURNSTILE_SECRET_KEY doubles as the IP-hash salt (server/ip.ts) — required
  // even though +1 skips Turnstile verification itself.
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[staging:vote] TURNSTILE_SECRET_KEY missing");
    return jsonError("server_misconfigured", 503);
  }
  if (!env.DB) {
    console.error("[staging:vote] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<StagingVoteRequest>;
  try {
    body = (await request.json()) as Partial<StagingVoteRequest>;
  } catch {
    return jsonError("venue_not_found", 400);
  }
  const venueId = typeof body.venueId === "string" ? body.venueId.trim() : "";
  if (venueId.length === 0) {
    return jsonError("venue_not_found", 400);
  }

  const ipHash = await hashIp(clientIp(request), secret);

  try {
    const db = getDb(env.DB);
    const outcome = await addVote(db, venueId, ipHash, PLUSONE_DAILY_LIMIT);

    switch (outcome.status) {
      case "not_found":
        return jsonError("venue_not_found", 404);
      case "rate_limited":
        console.warn("[staging:vote] daily +1 limit hit", { ipHash });
        return jsonError("rate_limited_plusone", 429);
      case "ok":
      case "duplicate": {
        // Both report the authoritative tally; a duplicate is an idempotent
        // success, so the client just reconciles its optimistic count.
        const payload: StagingVoteResponse = {
          venueId,
          voteCount: outcome.voteCount,
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
  } catch (err) {
    console.error("[staging:vote] vote failed", { err: String(err) });
    return jsonError("database_unavailable", 502);
  }
};

// GET /api/staging/names — the public, edge-cacheable dedup-match corpus for the
// staging form (issue #3). Returns ONLY {id, name, voteCount}, most-seconded
// first, capped at STAGING_MATCH_LIMIT.
//
// Unlike GET /api/staging (which marks per-viewer `votedByMe` and is therefore
// `private`), this response carries no viewer-specific data, so it is shared
// across ALL users and cached at the edge — the per-keystroke client matcher
// then costs ~zero Worker/D1 (most requests never reach the Worker). No auth /
// no rate limit (already-public content). Fail-soft: a missing/erroring D1
// binding returns a stable error code the client treats as "no corpus" (the
// hint is a soft enhancement, never blocking).
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb } from "@/server/db";
import { listStagingNames } from "@/server/staging";
import { jsonError } from "@/server/api-helpers";
import { STAGING_MATCH_LIMIT, type StagingNamesResponse } from "@/lib/staging";

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!env.DB) {
    return jsonError("database_unavailable", 503);
  }

  try {
    const db = getDb(env.DB);
    const venues = await listStagingNames(db, STAGING_MATCH_LIMIT);
    const payload: StagingNamesResponse = { venues };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        // PUBLIC edge cache (contrast GET /api/staging's `private`): no
        // per-viewer field here, so the whole corpus is shared. Short TTL keeps
        // it fresh-ish — it only shifts on new submissions / +1s.
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("[staging/names] query failed", { err: String(err) });
    return jsonError("server_error", 500);
  }
};

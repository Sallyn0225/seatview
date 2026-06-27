// GET /api/photos?venue=<id>&subMap=<id>[&offset=&limit=]
//
// Read-only listing of a sub-map's non-deleted annotation points, newest first
// (R3.9). Used by:
//   • the seatmap island when the user switches sub-map without a reload (it
//     omits offset/limit to get the FULL set so clustering is correct);
//   • the photo grid (step 5) with offset/limit for masonry pagination.
//
// No auth / no rate limit — this only exposes already-public content. Write
// paths (upload) carry Turnstile + KV limits in later steps.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb } from "@/server/db";
import { listSubMapPhotos } from "@/server/photos";

export const prerender = false;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
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

export const GET: APIRoute = async ({ url }) => {
  const venueId = url.searchParams.get("venue");
  const subMapId = url.searchParams.get("subMap");

  if (!venueId || !subMapId) {
    return jsonError("missing_venue_or_sub_map", 400);
  }

  if (!env.DB) {
    // D1 binding absent (misconfigured runtime). Surface as a server error
    // rather than throwing so the client gets the error Key State, not a crash.
    return jsonError("database_unavailable", 503);
  }

  try {
    const db = getDb(env.DB);
    const photos = await listSubMapPhotos(db, venueId, subMapId, {
      offset: parseCount(url.searchParams.get("offset")),
      limit: parseCount(url.searchParams.get("limit")),
    });
    return new Response(JSON.stringify({ photos }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Short edge cache: points change only on upload/delete (no auth here).
        "cache-control": "public, max-age=30",
      },
    });
  } catch {
    return jsonError("query_failed", 500);
  }
};

// /api/admin/photo-venues — venue facets for the admin photo filter (issue #28).
// Behind the same Cloudflare Access edge gate (ADR-11) + middleware admin guard
// as the rest of /api/admin/*; the handler re-checks maintainerEmail (defense in
// depth vs edge misconfig).
//
// GET  one row per venue that currently has ≥1 NON-deleted photo, with its live
//      count — feeds the "filter by venue" dropdown. Counts ignore the list's
//      `includeDeleted` audit toggle by design (always the live tally), so this
//      is fetched once on panel mount; the client decrements optimistically on
//      delete instead of re-fetching.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { maintainerEmail } from "@/server/admin-auth";
import { getDb } from "@/server/db";
import { listAdminPhotoVenueFacets } from "@/server/photos";
import type { AdminErrorCode, AdminPhotoVenuesResponse } from "@/lib/admin";

export const prerender = false;

function jsonError(code: AdminErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!maintainerEmail(request, env.DEV_ADMIN_EMAIL)) {
    return jsonError("unauthorized", 403);
  }
  if (!env.DB) {
    console.error("[admin:photo-venues] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  try {
    const db = getDb(env.DB);
    const venues = await listAdminPhotoVenueFacets(db);
    const payload: AdminPhotoVenuesResponse = { venues };
    return new Response(JSON.stringify(payload), {
      status: 200,
      // No edge cache — admin views must reflect deletes immediately.
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin:photo-venues] facet query failed", {
      err: String(err),
    });
    return jsonError("server_error", 500);
  }
};

// /api/admin/staging — maintainer staging-area triage (R7.2). ALL methods sit
// behind the Cloudflare Access edge gate (ADR-11) + the middleware admin guard.
//
// GET     list staging suggestions for maintainer triage (unprocessed first,
//         then processed, each group newest-first; issue #48). It already
//         exposes the `processed` flag (and the `voteCount`).
// PATCH   mark a suggestion processed / unprocessed (R7.2 "标记已处理"). The
//         actual "转正式" promotion is a GitHub PR, NOT a backend action (R7.3).
// DELETE  remove a suggestion outright (R7.2 "删除已处理的提交"). Staging rows
//         carry no media, so this is a hard delete.
//
// User-facing prose stays in i18n (R9); the API only returns stable error codes.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { maintainerEmail } from "@/server/admin-auth";
import { getDb } from "@/server/db";
import { jsonError, parseCount } from "@/server/api-helpers";
import {
  deleteStagingVenue,
  listStagingVenues,
  setStagingProcessed,
} from "@/server/staging";
import {
  ADMIN_STAGING_BATCH,
  type AdminDeleteStagingRequest,
  type AdminStagingMutationResponse,
  type AdminStagingResponse,
  type AdminUpdateStagingRequest,
} from "@/lib/admin";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!maintainerEmail(request, env.DEV_ADMIN_EMAIL)) {
    return jsonError("unauthorized", 403);
  }
  if (!env.DB) {
    console.error("[admin:staging] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  const offset = parseCount(url.searchParams.get("offset")) ?? 0;
  const limit =
    parseCount(url.searchParams.get("limit")) ?? ADMIN_STAGING_BATCH;

  try {
    const db = getDb(env.DB);
    const rows = await listStagingVenues(db, {
      offset,
      limit: limit + 1,
      sort: "adminTriage",
    });
    const hasMore = rows.length > limit;
    const payload: AdminStagingResponse = {
      venues: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin:staging] list query failed", { err: String(err) });
    return jsonError("server_error", 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const email = maintainerEmail(request, env.DEV_ADMIN_EMAIL);
  if (!email) return jsonError("unauthorized", 403);
  if (!env.DB) {
    console.error("[admin:staging] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<AdminUpdateStagingRequest>;
  try {
    body = (await request.json()) as Partial<AdminUpdateStagingRequest>;
  } catch {
    return jsonError("missing_id", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const processed = body.processed === true;
  if (id.length === 0) return jsonError("missing_id", 400);

  try {
    const db = getDb(env.DB);
    const ok = await setStagingProcessed(db, id, processed);
    if (!ok) return jsonError("not_found", 404);
    console.info("[admin:staging] processed flag set", {
      id,
      processed,
      by: email,
    });
    const payload: AdminStagingMutationResponse = { id };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin:staging] processed update failed", {
      id,
      err: String(err),
    });
    return jsonError("database_unavailable", 502);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const email = maintainerEmail(request, env.DEV_ADMIN_EMAIL);
  if (!email) return jsonError("unauthorized", 403);
  if (!env.DB) {
    console.error("[admin:staging] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<AdminDeleteStagingRequest>;
  try {
    body = (await request.json()) as Partial<AdminDeleteStagingRequest>;
  } catch {
    return jsonError("missing_id", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (id.length === 0) return jsonError("missing_id", 400);

  try {
    const db = getDb(env.DB);
    const ok = await deleteStagingVenue(db, id);
    if (!ok) return jsonError("not_found", 404);
    console.info("[admin:staging] suggestion deleted", { id, by: email });
    const payload: AdminStagingMutationResponse = { id };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin:staging] delete failed", { id, err: String(err) });
    return jsonError("database_unavailable", 502);
  }
};

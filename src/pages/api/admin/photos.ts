// /api/admin/photos — maintainer photo moderation (R7.2). ALL methods sit behind
// the Cloudflare Access edge gate (ADR-11); the middleware admin guard
// additionally rejects requests lacking a maintainer identity (defense in
// depth), so these handlers can assume an authenticated maintainer.
//
// GET     list ALL photos newest-first (across venues/sub-maps), paged. Defaults
//         to non-deleted rows; `?includeDeleted=1` audits removed content.
// DELETE  soft-delete one photo: set D1 `deleted_at` (ADR-6 — the public
//         seatmap/grid queries filter `deleted_at IS NULL`, so the pin + card
//         vanish for users) AND physically delete the R2 object (节省存储, not
//         reversible — the maintainer confirms in the UI first).
//
// User-facing prose stays in i18n (R9); the API only returns stable error codes.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { maintainerEmail } from "@/server/admin-auth";
import { getDb } from "@/server/db";
import { listAllPhotosForAdmin, softDeletePhoto } from "@/server/photos";
import { deleteImage } from "@/server/r2/images";
import {
  ADMIN_PHOTOS_BATCH,
  type AdminDeletePhotoRequest,
  type AdminDeletePhotoResponse,
  type AdminErrorCode,
  type AdminPhotosResponse,
} from "@/lib/admin";

export const prerender = false;

function jsonError(code: AdminErrorCode, status: number): Response {
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

export const GET: APIRoute = async ({ request, url }) => {
  // Defense-in-depth: the edge gate (Access) already authenticated, but re-check
  // here so a misconfigured edge cannot expose the list.
  if (!maintainerEmail(request, env.DEV_ADMIN_EMAIL)) {
    return jsonError("unauthorized", 403);
  }
  if (!env.DB) {
    console.error("[admin:photos] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  const offset = parseCount(url.searchParams.get("offset")) ?? 0;
  const limit = parseCount(url.searchParams.get("limit")) ?? ADMIN_PHOTOS_BATCH;
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";

  try {
    const db = getDb(env.DB);
    // Over-fetch one row as a hasMore probe (same trick as the public grid),
    // then trim so `photos` is exactly `limit` long.
    const rows = await listAllPhotosForAdmin(db, {
      offset,
      limit: limit + 1,
      includeDeleted,
    });
    const hasMore = rows.length > limit;
    const payload: AdminPhotosResponse = {
      photos: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      // No edge cache — admin views must reflect deletes immediately.
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[admin:photos] list query failed", { err: String(err) });
    return jsonError("server_error", 500);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const email = maintainerEmail(request, env.DEV_ADMIN_EMAIL);
  if (!email) return jsonError("unauthorized", 403);
  if (!env.DB) {
    console.error("[admin:photos] DB binding missing");
    return jsonError("database_unavailable", 503);
  }
  if (!env.BUCKET) {
    console.error("[admin:photos] BUCKET R2 binding missing");
    return jsonError("storage_unavailable", 503);
  }

  let body: Partial<AdminDeletePhotoRequest>;
  try {
    body = (await request.json()) as Partial<AdminDeletePhotoRequest>;
  } catch {
    return jsonError("missing_id", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (id.length === 0) return jsonError("missing_id", 400);

  let imageKey: string | null;
  try {
    const db = getDb(env.DB);
    // D1 soft-delete first (ADR-6). This is the source of truth for visibility —
    // even if the R2 purge below fails, the row is already hidden everywhere.
    imageKey = await softDeletePhoto(db, id);
  } catch (err) {
    console.error("[admin:photos] soft-delete failed", {
      id,
      err: String(err),
    });
    return jsonError("database_unavailable", 502);
  }

  if (imageKey === null) {
    return jsonError("not_found", 404);
  }

  // Physically purge the R2 object (节省存储, irreversible). Best-effort: a purge
  // failure must not undo the already-applied soft-delete — the maintainer can
  // sweep orphans later. Log the deletion as a key moderation event.
  let objectPurged = true;
  try {
    await deleteImage(env.BUCKET, imageKey);
  } catch (err) {
    objectPurged = false;
    console.warn("[admin:photos] R2 purge failed (D1 soft-delete stands)", {
      id,
      key: imageKey,
      err: String(err),
    });
  }
  console.info("[admin:photos] photo soft-deleted", {
    id,
    by: email,
    objectPurged,
  });

  const payload: AdminDeletePhotoResponse = { id, objectPurged };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

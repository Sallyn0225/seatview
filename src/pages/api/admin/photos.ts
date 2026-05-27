// /api/admin/photos — maintainer photo moderation (R7.2, recycle bin issue #29).
// ALL methods sit behind the Cloudflare Access edge gate (ADR-11); the
// middleware admin guard additionally rejects requests lacking a maintainer
// identity (defense in depth), so these handlers can assume an authenticated
// maintainer.
//
// GET     list photos newest-first (across venues/sub-maps), paged. Defaults to
//         LIVE rows; `?onlyDeleted=1` lists the recycle bin instead.
// DELETE  `{id}`                 → move to recycle bin: set D1 `deleted_at` only
//                                   (public queries filter `deleted_at IS NULL`,
//                                   so the pin + card vanish), R2 object KEPT so
//                                   the photo can be restored.
//         `{id, permanent:true}` → 彻底删除: physically remove a recycle-bin row
//                                   after purging the R2 object. Irreversible.
// PATCH   `{id}`                 → restore from the recycle bin (clear
//                                   `deleted_at` after verifying the R2 object).
//
// User-facing prose stays in i18n (R9); the API only returns stable error codes.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { maintainerEmail } from "@/server/admin-auth";
import { getDb } from "@/server/db";
import {
  getDeletedPhotoImageKey,
  hardDeletePhoto,
  listAllPhotosForAdmin,
  restorePhoto,
  softDeletePhoto,
} from "@/server/photos";
import { deleteImage, imageExists } from "@/server/r2/images";
import {
  ADMIN_PHOTOS_BATCH,
  type AdminDeletePhotoRequest,
  type AdminErrorCode,
  type AdminPhotoMutationResponse,
  type AdminPhotosResponse,
  type AdminRestorePhotoRequest,
} from "@/lib/admin";

export const prerender = false;

function jsonError(code: AdminErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** 200 with an admin mutation payload. No edge cache — admin views must reflect
 *  the delete/restore/purge immediately. */
function jsonResponse(payload: AdminPhotoMutationResponse): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
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
  // `?onlyDeleted=1` → the recycle bin view (soft-deleted rows); otherwise the
  // live moderation view (issue #29).
  const onlyDeleted = url.searchParams.get("onlyDeleted") === "1";
  // Optional venue filter (issue #28). Empty/absent → all venues; an unknown
  // slug simply yields an empty page (parameterized eq, no injection risk).
  const venueParam = url.searchParams.get("venueId")?.trim();
  const venueId = venueParam ? venueParam : undefined;

  try {
    const db = getDb(env.DB);
    // Over-fetch one row as a hasMore probe (same trick as the public grid),
    // then trim so `photos` is exactly `limit` long.
    const rows = await listAllPhotosForAdmin(db, {
      offset,
      limit: limit + 1,
      onlyDeleted,
      venueId,
    });
    const hasMore = rows.length > limit;
    const payload: AdminPhotosResponse = {
      photos: hasMore ? rows.slice(0, limit) : rows,
      hasMore,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      // No edge cache — admin views must reflect deletes immediately.
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
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

  let body: Partial<AdminDeletePhotoRequest>;
  try {
    body = (await request.json()) as Partial<AdminDeletePhotoRequest>;
  } catch {
    return jsonError("missing_id", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (id.length === 0) return jsonError("missing_id", 400);
  const permanent = body.permanent === true;

  const db = getDb(env.DB);

  // ── 彻底删除 (issue #29): physically remove a recycle-bin row + purge R2. ───
  if (permanent) {
    if (!env.BUCKET) {
      console.error("[admin:photos] BUCKET R2 binding missing");
      return jsonError("storage_unavailable", 503);
    }
    let imageKey: string | null;
    try {
      imageKey = await getDeletedPhotoImageKey(db, id);
    } catch (err) {
      console.error("[admin:photos] hard-delete lookup failed", {
        id,
        err: String(err),
      });
      return jsonError("database_unavailable", 502);
    }
    if (imageKey === null) return jsonError("not_found", 404);

    // Purge R2 before removing the D1 row. If storage fails, the recycle-bin row
    // keeps its image key so a maintainer can retry the permanent delete.
    try {
      await deleteImage(env.BUCKET, imageKey);
    } catch (err) {
      console.warn("[admin:photos] R2 purge failed; D1 row retained", {
        id,
        key: imageKey,
        err: String(err),
      });
      return jsonError("storage_unavailable", 502);
    }

    try {
      const deletedImageKey = await hardDeletePhoto(db, id);
      if (deletedImageKey === null) return jsonError("not_found", 404);
    } catch (err) {
      console.error("[admin:photos] hard-delete failed after R2 purge", {
        id,
        key: imageKey,
        err: String(err),
      });
      return jsonError("database_unavailable", 502);
    }
    console.info("[admin:photos] photo permanently deleted", {
      id,
      by: email,
    });
    return jsonResponse({ id });
  }

  // ── Move to recycle bin: D1 soft-delete only, R2 object KEPT (restorable). ───
  let imageKey: string | null;
  try {
    imageKey = await softDeletePhoto(db, id);
  } catch (err) {
    console.error("[admin:photos] soft-delete failed", {
      id,
      err: String(err),
    });
    return jsonError("database_unavailable", 502);
  }
  if (imageKey === null) return jsonError("not_found", 404);

  console.info("[admin:photos] photo moved to recycle bin", { id, by: email });
  return jsonResponse({ id });
};

export const PATCH: APIRoute = async ({ request }) => {
  const email = maintainerEmail(request, env.DEV_ADMIN_EMAIL);
  if (!email) return jsonError("unauthorized", 403);
  if (!env.DB) {
    console.error("[admin:photos] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<AdminRestorePhotoRequest>;
  try {
    body = (await request.json()) as Partial<AdminRestorePhotoRequest>;
  } catch {
    return jsonError("missing_id", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (id.length === 0) return jsonError("missing_id", 400);
  if (!env.BUCKET) {
    console.error("[admin:photos] BUCKET R2 binding missing");
    return jsonError("storage_unavailable", 503);
  }

  const db = getDb(env.DB);
  let imageKey: string | null;
  try {
    imageKey = await getDeletedPhotoImageKey(db, id);
  } catch (err) {
    console.error("[admin:photos] restore lookup failed", {
      id,
      err: String(err),
    });
    return jsonError("database_unavailable", 502);
  }
  if (imageKey === null) return jsonError("not_found", 404);

  try {
    if (!(await imageExists(env.BUCKET, imageKey))) {
      console.warn("[admin:photos] restore blocked; R2 object missing", {
        id,
        key: imageKey,
      });
      return jsonError("not_found", 404);
    }
  } catch (err) {
    console.warn("[admin:photos] R2 restore check failed", {
      id,
      key: imageKey,
      err: String(err),
    });
    return jsonError("storage_unavailable", 502);
  }

  try {
    imageKey = await restorePhoto(db, id);
  } catch (err) {
    console.error("[admin:photos] restore failed", { id, err: String(err) });
    return jsonError("database_unavailable", 502);
  }
  if (imageKey === null) return jsonError("not_found", 404);

  console.info("[admin:photos] photo restored", { id, by: email });
  return jsonResponse({ id });
};

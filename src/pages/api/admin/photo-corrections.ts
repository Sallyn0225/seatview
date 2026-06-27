// /api/admin/photo-corrections — maintainer triage for seat-label correction
// requests (issue #83). Behind Cloudflare Access plus middleware; this route
// still re-checks maintainer identity for defense in depth.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { maintainerEmail } from "@/server/admin-auth";
import { getDb } from "@/server/db";
import {
  approvePhotoCorrection,
  listPhotoCorrectionsForAdmin,
  rejectPhotoCorrection,
} from "@/server/photo-corrections";
import {
  ADMIN_PHOTO_CORRECTIONS_BATCH,
  type AdminErrorCode,
  type AdminPhotoCorrectionMutationResponse,
  type AdminPhotoCorrectionsResponse,
  type AdminUpdatePhotoCorrectionRequest,
} from "@/lib/admin";

export const prerender = false;

function jsonError(code: AdminErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseCount(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!maintainerEmail(request, env.DEV_ADMIN_EMAIL)) {
    return jsonError("unauthorized", 403);
  }
  if (!env.DB) {
    console.error("[admin:photo-corrections] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  const offset = parseCount(url.searchParams.get("offset")) ?? 0;
  const limit =
    parseCount(url.searchParams.get("limit")) ?? ADMIN_PHOTO_CORRECTIONS_BATCH;

  try {
    const db = getDb(env.DB);
    const rows = await listPhotoCorrectionsForAdmin(db, {
      offset,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const payload: AdminPhotoCorrectionsResponse = {
      requests: hasMore ? rows.slice(0, limit) : rows,
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
    console.error("[admin:photo-corrections] list query failed", {
      err: String(err),
    });
    return jsonError("server_error", 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const email = maintainerEmail(request, env.DEV_ADMIN_EMAIL);
  if (!email) return jsonError("unauthorized", 403);
  if (!env.DB) {
    console.error("[admin:photo-corrections] DB binding missing");
    return jsonError("database_unavailable", 503);
  }

  let body: Partial<AdminUpdatePhotoCorrectionRequest>;
  try {
    body = (await request.json()) as Partial<AdminUpdatePhotoCorrectionRequest>;
  } catch {
    return jsonError("missing_fields", 400);
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action;
  if (id.length === 0 || (action !== "approve" && action !== "reject")) {
    return jsonError("missing_fields", 400);
  }

  try {
    const db = getDb(env.DB);
    const outcome =
      action === "approve"
        ? await approvePhotoCorrection(db, id)
        : await rejectPhotoCorrection(db, id);
    if (outcome.status === "not_found") return jsonError("not_found", 404);

    console.info("[admin:photo-corrections] request handled", {
      id,
      action,
      by: email,
    });
    const payload: AdminPhotoCorrectionMutationResponse = { id };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin:photo-corrections] mutation failed", {
      id,
      action,
      err: String(err),
    });
    return jsonError("database_unavailable", 502);
  }
};

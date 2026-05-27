// Browser-side admin transport (R7). Mirrors staging-client.ts: typed fetch
// wrappers over the `/api/admin/*` routes that turn non-OK responses into a
// typed AdminError the island maps to localized inline copy (R9). No retries —
// a maintainer action either succeeds or surfaces an error to retry by hand.
//
// In production every request is already authenticated by Cloudflare Access at
// the edge (ADR-11), so the browser sends nothing special; in local dev the
// Worker honours DEV_ADMIN_EMAIL.

import type {
  AdminDeletePhotoRequest,
  AdminDeletePhotoResponse,
  AdminDeleteStagingRequest,
  AdminErrorCode,
  AdminPhotosResponse,
  AdminPhotoVenuesResponse,
  AdminStagingMutationResponse,
  AdminStagingResponse,
  AdminUpdateStagingRequest,
} from "@/lib/admin";

/** A typed transport failure the admin island maps to localized inline copy. */
export class AdminError extends Error {
  constructor(
    readonly code: AdminErrorCode | "network",
    readonly status?: number,
  ) {
    super(code);
    this.name = "AdminError";
  }
}

async function parseErrorCode(
  res: Response,
): Promise<AdminErrorCode | "network"> {
  try {
    const data = (await res.json()) as { error?: AdminErrorCode };
    return data.error ?? "server_error";
  } catch {
    return "server_error";
  }
}

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new AdminError("network");
  }
  if (!res.ok) {
    throw new AdminError(await parseErrorCode(res), res.status);
  }
  return (await res.json()) as T;
}

// ── Photos ──────────────────────────────────────────────────────────────────

/** Fetch one page of photos for the admin list (newest-first). Pass `venueId`
 *  to restrict to one venue (issue #28 filter); null/undefined → all venues. */
export async function fetchAdminPhotos(
  offset: number,
  limit: number,
  includeDeleted: boolean,
  venueId?: string | null,
  signal?: AbortSignal,
): Promise<AdminPhotosResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (includeDeleted) params.set("includeDeleted", "1");
  if (venueId) params.set("venueId", venueId);
  return jsonRequest<AdminPhotosResponse>(`/api/admin/photos?${params}`, {
    signal,
  });
}

/** Fetch venue facets (venues with ≥1 live photo + counts) for the filter
 *  dropdown. Fetched once on panel mount. */
export async function fetchAdminPhotoVenues(
  signal?: AbortSignal,
): Promise<AdminPhotoVenuesResponse> {
  return jsonRequest<AdminPhotoVenuesResponse>("/api/admin/photo-venues", {
    signal,
  });
}

/** Soft-delete one photo (+ R2 purge, server-side). Not retried. */
export async function deleteAdminPhoto(
  id: string,
  signal?: AbortSignal,
): Promise<AdminDeletePhotoResponse> {
  const body: AdminDeletePhotoRequest = { id };
  return jsonRequest<AdminDeletePhotoResponse>("/api/admin/photos", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

// ── Staging ───────────────────────────────────────────────────────────────--

/** Fetch one page of staging suggestions for the admin list. */
export async function fetchAdminStaging(
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<AdminStagingResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return jsonRequest<AdminStagingResponse>(`/api/admin/staging?${params}`, {
    signal,
  });
}

/** Toggle a staging suggestion's processed flag. Not retried. */
export async function setAdminStagingProcessed(
  id: string,
  processed: boolean,
  signal?: AbortSignal,
): Promise<AdminStagingMutationResponse> {
  const body: AdminUpdateStagingRequest = { id, processed };
  return jsonRequest<AdminStagingMutationResponse>("/api/admin/staging", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

/** Delete a staging suggestion outright. Not retried. */
export async function deleteAdminStaging(
  id: string,
  signal?: AbortSignal,
): Promise<AdminStagingMutationResponse> {
  const body: AdminDeleteStagingRequest = { id };
  return jsonRequest<AdminStagingMutationResponse>("/api/admin/staging", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

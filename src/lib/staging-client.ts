// Browser-side staging transport (R6). Two calls, mirroring upload-client.ts:
//   1. submitStaging — POST /api/staging with the name + Turnstile token. NOT
//      retried (a 4xx here is a real rejection: Turnstile / 5/day limit / empty).
//   2. fetchStagingPage — GET /api/staging?offset=&limit= for the
//      IntersectionObserver continuation (the first batch is SSR-injected).
//
// User-facing prose stays in i18n; the API returns stable codes which the form
// maps to localized inline copy (R9).

import type {
  StagingCreateResponse,
  StagingErrorCode,
  StagingListResponse,
  StagingRequest,
} from "@/lib/staging";

/** A typed transport failure the form maps to localized inline copy. */
export class StagingError extends Error {
  constructor(
    readonly code: StagingErrorCode | "network",
    readonly status?: number,
  ) {
    super(code);
    this.name = "StagingError";
  }
}

async function parseErrorCode(
  res: Response,
): Promise<StagingErrorCode | "network"> {
  try {
    const data = (await res.json()) as { error?: StagingErrorCode };
    return data.error ?? "server_error";
  } catch {
    return "server_error";
  }
}

/** Submit one staging suggestion. Not retried. Resolves with the created DTO. */
export async function submitStaging(
  name: string,
  turnstileToken: string,
  signal?: AbortSignal,
): Promise<StagingCreateResponse> {
  const body: StagingRequest = { name, turnstileToken };
  let res: Response;
  try {
    res = await fetch("/api/staging", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new StagingError("network");
  }
  if (!res.ok) {
    throw new StagingError(await parseErrorCode(res), res.status);
  }
  return (await res.json()) as StagingCreateResponse;
}

/**
 * Fetch one page of staging suggestions (newest-first, R6.4). Throws on a
 * non-OK response so the caller can show its LoadFailure state.
 */
export async function fetchStagingPage(
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<StagingListResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  const res = await fetch(`/api/staging?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`fetch staging failed: ${res.status}`);
  }
  const data = (await res.json()) as StagingListResponse;
  return { venues: data.venues ?? [], hasMore: data.hasMore ?? false };
}

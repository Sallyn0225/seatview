// Browser-side upload transport (R4 §8 + ADR-12). Two calls:
//   1. signUpload   — POST /api/upload/sign with the metadata + Turnstile token.
//                     Returns the HMAC ticket. NOT retried (a 4xx here is a real
//                     rejection: Turnstile / rate limit / bad fields).
//   2. commitUpload — POST /api/upload/commit (multipart) with the ticket + the
//                     compressed WebP bytes. RETRIED per ADR-12: up to 2 retries
//                     (3 attempts total), exponential backoff 1s / 3s, ONLY on
//                     network error or 5xx. 4xx (expired ticket, too large) does
//                     NOT retry. The ticket (and the Turnstile token already
//                     consumed at sign time) is reused across retries — no token
//                     waste.
//
// The Sheet drives the retry UI ("重试中... (2/3)") off the `onAttempt` callback.

import type {
  CommitResponse,
  SignRequest,
  SignResponse,
  UploadErrorCode,
  UploadFields,
} from "@/lib/upload";

/** A typed transport failure the Sheet maps to localized inline copy. */
export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode | "network",
    readonly status?: number,
  ) {
    super(code);
    this.name = "UploadError";
  }
}

async function parseErrorCode(res: Response): Promise<UploadErrorCode | "network"> {
  try {
    const data = (await res.json()) as { error?: UploadErrorCode };
    return data.error ?? "server_error";
  } catch {
    return "server_error";
  }
}

/** Step 1: exchange fields + token for a signed ticket. Not retried. */
export async function signUpload(
  fields: UploadFields,
  turnstileToken: string,
  signal?: AbortSignal,
): Promise<SignResponse> {
  const body: SignRequest = { ...fields, turnstileToken };
  let res: Response;
  try {
    res = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new UploadError("network");
  }
  if (!res.ok) {
    throw new UploadError(await parseErrorCode(res), res.status);
  }
  return (await res.json()) as SignResponse;
}

/** ADR-12 backoff schedule (ms) before attempt 2 and attempt 3. */
const RETRY_BACKOFF_MS = [1000, 3000];
const MAX_ATTEMPTS = 3;

export interface CommitOptions {
  signal?: AbortSignal;
  /** Called before each attempt with the 1-based attempt number (retry UI). */
  onAttempt?: (attempt: number, total: number) => void;
}

/**
 * Step 2: send the ticket + compressed bytes; persist on the server. Retries on
 * network/5xx only (ADR-12). Resolves with the created photo DTO.
 */
export async function commitUpload(
  ticket: string,
  image: File,
  options: CommitOptions = {},
): Promise<CommitResponse> {
  const { signal, onAttempt } = options;
  let lastError: UploadError = new UploadError("network");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt?.(attempt, MAX_ATTEMPTS);

    const form = new FormData();
    form.append("ticket", ticket);
    form.append("image", image, image.name);

    try {
      const res = await fetch("/api/upload/commit", {
        method: "POST",
        body: form,
        signal,
      });
      if (res.ok) {
        return (await res.json()) as CommitResponse;
      }
      // 4xx → terminal (do not retry). 5xx → retryable.
      const code = await parseErrorCode(res);
      if (res.status < 500) {
        throw new UploadError(code, res.status);
      }
      lastError = new UploadError(code, res.status);
    } catch (err) {
      // A thrown UploadError from the 4xx branch above is terminal — rethrow.
      if (err instanceof UploadError && err.status && err.status < 500) {
        throw err;
      }
      // AbortError → caller cancelled; surface as-is (not a retry).
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new UploadError("network");
      }
      lastError = new UploadError("network");
    }

    // Backoff before the next attempt (if any).
    const backoff = RETRY_BACKOFF_MS[attempt - 1];
    if (attempt < MAX_ATTEMPTS && backoff !== undefined) {
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw lastError;
}

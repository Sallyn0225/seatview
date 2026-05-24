// Cloudflare Turnstile server-side verification (R8.3, two-step validation).
//
// Step 1 (client): the Turnstile widget renders in the upload Sheet's Step 5 and
//   produces a one-time token.
// Step 2 (server): we POST that token + our secret to Cloudflare's siteverify
//   endpoint. Only a `success: true` response lets the upload proceed.
//
// Local dev uses Cloudflare's documented ALWAYS-PASS test keys so the flow is
// exercisable offline (no real challenge):
//   site key   1x00000000000000000000AA   (PUBLIC_TURNSTILE_SITE_KEY, wrangler.jsonc)
//   secret key 1x0000000000000000000000000000000AA (TURNSTILE_SECRET_KEY, .dev.vars)
// In production both come from env/secrets (never hard-coded).
//
// ADR-12 note: the CLIENT reuses the same token across direct-upload retries so
// it does not waste tokens; the SERVER verifies the token exactly once, on the
// sign step, before issuing the upload ticket.

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  success: boolean;
  /** Cloudflare error codes, surfaced to the Worker log (not the client). */
  errorCodes?: string[];
}

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify a Turnstile token against Cloudflare. `remoteIp` is the raw client IP
 * (optional but recommended — Cloudflare cross-checks it). Returns a structured
 * result instead of throwing so the caller decides the HTTP response + logging.
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp && remoteIp !== "unknown") body.append("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    if (!res.ok) {
      return { success: false, errorCodes: [`http_${res.status}`] };
    }
    const data = (await res.json()) as SiteverifyResponse;
    return {
      success: data.success === true,
      errorCodes: data["error-codes"],
    };
  } catch {
    return { success: false, errorCodes: ["network_error"] };
  }
}

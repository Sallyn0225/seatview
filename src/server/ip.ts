// IP extraction + hashing for rate limiting and abuse tracking.
//
// We NEVER store or key on the raw client IP (prd Data Model: "ip_hash 哈希,
// 不存原 IP"). The raw IP only lives in-memory for the duration of one request,
// just long enough to derive a stable SHA-256 hash. The hash is what the D1
// `photos.ip_hash` column and the KV rate-limit keys see.
//
// Reused by the upload step now and the staging step (step 7) — both need the
// same "behind-Cloudflare client IP → hash" transform.

/**
 * Best-effort client IP behind Cloudflare. `cf-connecting-ip` is set by the
 * edge for real traffic; `x-forwarded-for` is a local-dev fallback. Returns
 * `"unknown"` when neither is present so hashing still produces a stable key
 * (all anonymous-IP traffic then shares one bucket — acceptable for the MVP).
 */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/**
 * SHA-256 hash of the client IP, hex-encoded. A per-deployment salt (the
 * Turnstile secret, which is already a server-only secret) is mixed in so the
 * hash is not a plain rainbow-table-able SHA-256 of an IP. Async because
 * WebCrypto's digest is async on Workers.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

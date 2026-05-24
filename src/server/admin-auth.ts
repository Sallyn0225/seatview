// Maintainer identity resolution for the admin surface (R7, ADR-11).
//
// Production: `/admin` + `/api/admin/*` are fronted by a Cloudflare Access
// (Zero Trust) application + policy configured once in the CF dashboard (see
// README). Access authenticates the maintainer via GitHub / Google SSO at the
// EDGE and forwards the verified identity in the
// `Cf-Access-Authenticated-User-Email` header. The Worker never sees anonymous
// traffic on these paths, so trusting that header is safe — Access strips any
// client-supplied copy and re-signs it.
//
// Local dev: there is no Access edge, so we mock it. When `DEV_ADMIN_EMAIL` is
// present (from .dev.vars), any request to an admin path is treated as coming
// from that maintainer. This is the documented local-mock from the task / ADR-11
// ("本地开发需 mock 该头或用 cloudflared tunnel"). DEV_ADMIN_EMAIL must NEVER be
// set in production — it would open the gate without SSO.
//
// Fail closed: if neither the Access header nor the dev mock yields an email,
// the maintainer is treated as unauthenticated.

/** Header Cloudflare Access injects with the verified maintainer email. */
export const CF_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

/**
 * Resolve the authenticated maintainer email for an admin request, or `null`
 * when unauthenticated.
 *
 * @param request    the incoming Request (carries the Access header in prod)
 * @param devEmail    `env.DEV_ADMIN_EMAIL` — the local-dev mock identity
 */
export function maintainerEmail(
  request: Request,
  devEmail: string | undefined,
): string | null {
  // Production / edge path: trust the Access-injected header.
  const header = request.headers.get(CF_ACCESS_EMAIL_HEADER);
  if (header && header.trim().length > 0) return header.trim();

  // Local-dev mock: only honoured when DEV_ADMIN_EMAIL is configured.
  if (devEmail && devEmail.trim().length > 0) return devEmail.trim();

  return null;
}

/** Convenience boolean: is this admin request authenticated at all. */
export function isMaintainer(
  request: Request,
  devEmail: string | undefined,
): boolean {
  return maintainerEmail(request, devEmail) !== null;
}

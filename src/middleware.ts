import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import {
  defaultLocale,
  isLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/i18n/config";
import { isMaintainer } from "@/server/admin-auth";

// Match the admin page (`/zh/admin`, `/ja/admin`) and the admin API namespace
// (`/api/admin/*`). Both must be protected (R7.1 / ADR-11).
const ADMIN_PAGE = /^\/(zh|ja)\/admin\/?$/;
const ADMIN_API = /^\/api\/admin(\/|$)/;

function isAdminPath(pathname: string): boolean {
  return ADMIN_PAGE.test(pathname) || ADMIN_API.test(pathname);
}

// Middleware responsibilities (run in order on every request):
//   1. Bare root `/` → 302 to the best locale (Accept-Language, R9.2).
//   2. Resolve the active locale from the URL prefix and expose it on
//      `locals.locale` for pages + islands.
//   3. Admin guard (R7.1 / ADR-11): defense-in-depth check that the request
//      carries a maintainer identity. In production Cloudflare Access is the
//      real gate at the edge (anonymous traffic never arrives here); this guard
//      additionally rejects anything lacking the Access-injected email, and in
//      local dev honours the DEV_ADMIN_EMAIL mock. Only the `/admin` page +
//      `/api/admin/*` are affected — all other routes pass through untouched.
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (pathname === "/") {
    const locale = resolveLocaleFromAcceptLanguage(
      context.request.headers.get("accept-language"),
    );
    return context.redirect(`/${locale}/`, 302);
  }

  const segment = pathname.split("/")[1];
  const locale = isLocale(segment) ? segment : defaultLocale;
  context.locals.locale = locale;

  // Admin guard — fail closed when no maintainer identity is present.
  if (isAdminPath(pathname)) {
    const authed = isMaintainer(context.request, env.DEV_ADMIN_EMAIL);
    if (!authed) {
      // API → JSON 403 (the island shows its error state); page → 403 with a
      // short body. Production never lands here for an authorized maintainer
      // because Access blocks unauthenticated requests at the edge first.
      if (ADMIN_API.test(pathname)) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        "403 Forbidden — this page requires maintainer access.",
        {
          status: 403,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }
  }

  return next();
});

// GET /sitemap.xml — locale-aware sitemap with hreflang alternates (R2.1).
//
// One <url> per (path × locale). Each entry advertises every locale variant via
// <xhtml:link rel="alternate"> (+ x-default → the default locale), matching the
// hreflang links emitted in <head>. Driven by the static `venues` array, so it
// stays in sync as venues are added by PR — zero D1 access.
import type { APIRoute } from "astro";
import { venues } from "@/data/venues";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { HREFLANG } from "@/lib/seo/hreflang";

export const prerender = false;

// Public, indexable routes only (no admin / staging / api). Each is the
// locale-independent remainder; "/" is the home page.
const STATIC_PATHS = ["/", "/links", "/privacy", "/terms"] as const;

function localePath(loc: Locale, rest: string): string {
  return rest === "/" ? `/${loc}/` : `/${loc}${rest}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const GET: APIRoute = ({ request }) => {
  const siteUrl =
    import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const restPaths = [...STATIC_PATHS, ...venues.map((v) => `/v/${v.id}`)];

  const urls: string[] = [];
  for (const rest of restPaths) {
    // Pre-compute the alternate set once per path (same for every locale entry).
    const links = [
      ...locales.map(
        (loc) =>
          `<xhtml:link rel="alternate" hreflang="${HREFLANG[loc]}" href="${xmlEscape(
            new URL(localePath(loc, rest), siteUrl).href,
          )}"/>`,
      ),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(
        new URL(localePath(defaultLocale, rest), siteUrl).href,
      )}"/>`,
    ].join("");

    for (const loc of locales) {
      const lofrom = xmlEscape(new URL(localePath(loc, rest), siteUrl).href);
      urls.push(`<url><loc>${lofrom}</loc>${links}</url>`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};

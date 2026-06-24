// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// SeatView (seatmap-real) — Astro 6 + Cloudflare Workers SSR.
//
// Notes for maintainers:
// - Astro 6+ dropped the Cloudflare Pages adapter; this targets Cloudflare
//   Workers (static assets are served by the same Worker).
// - Tailwind v4 is wired through the official Vite plugin, NOT the deprecated
//   `@astrojs/tailwind` integration.
// - i18n routing is built in (no third-party package). Every locale is
//   prefixed (`/zh/...`, `/ja/...`, `/en/...`, `/ko/...`); the bare root `/`
//   performs an Accept-Language 302 redirect in `src/middleware.ts`.
// - zh/ja are equal tracks (Two Tongues Rule); en/ko are an accessibility
//   translation layer. Keep `locales` in sync with `src/i18n/config.ts`.
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    // Build-time image processing (no Cloudflare Images binding required).
    imageService: "compile",
  }),
  integrations: [react()],
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "ja", "en", "ko"],
    routing: {
      // Every locale carries an explicit prefix so URLs are unambiguous and
      // SEO-friendly; the bare `/` is handled by a manual redirect.
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    define: {
      // Build-time timestamp, inlined once when this config is evaluated (the
      // `astro build` moment on the build machine). Used as the sitemap
      // `<lastmod>` — stable across requests within a deploy. The SSR sitemap
      // route runs per-request, so a `new Date()` there would be request time
      // and make lastmod churn on every hit; this changes only on redeploy. The
      // sitemap is kept intentionally D1-free, so per-venue freshness isn't
      // available — this is a site-wide "last deployed" signal.
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
});

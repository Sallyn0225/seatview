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
// - i18n routing is built in (no third-party package). Both locales are
//   prefixed (`/zh/...`, `/ja/...`); the bare root `/` performs an
//   Accept-Language 302 redirect in `src/pages/index.astro`.
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
    locales: ["zh", "ja"],
    routing: {
      // Both locales carry an explicit prefix so URLs are unambiguous and
      // SEO-friendly; the bare `/` is handled by a manual redirect.
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

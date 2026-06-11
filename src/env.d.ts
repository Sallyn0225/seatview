/// <reference types="astro/client" />

// No top-level imports: keeping this an ambient (global) script so the
// `App.Locals` augmentation applies project-wide. Types are referenced inline.

// Cloudflare runtime bindings. Read via `import { env } from "cloudflare:workers"`
// in pages / API routes (Astro v6 removed `Astro.locals.runtime.env`). Keep in
// sync with wrangler.jsonc bindings; mirrored onto `Cloudflare.Env` below.
interface CloudflareEnv {
  DB: import("@cloudflare/workers-types").D1Database;
  BUCKET: import("@cloudflare/workers-types").R2Bucket;
  RATE_LIMIT: import("@cloudflare/workers-types").KVNamespace;
  // Injected by the Astro Cloudflare adapter.
  ASSETS: import("@cloudflare/workers-types").Fetcher;
  SESSION: import("@cloudflare/workers-types").KVNamespace;
  // Public vars
  PUBLIC_TURNSTILE_SITE_KEY: string;
  PUBLIC_SITE_URL: string;
  // Base URL for R2 public-read uploaded images (custom domain / r2.dev). The
  // stored `image_key` is appended to this to build a fetchable URL
  // (src/lib/photos.ts imageKeyToUrl). Empty/absent → same-origin /r2/ fallback.
  PUBLIC_R2_BASE_URL?: string;
  // giscus venue comments (task 06-10-giscus). Non-secret resource identifiers;
  // the client reads the build-time copies from .env* — these are the runtime
  // parity copies (wrangler.jsonc `vars`). CATEGORY_ID is empty until the
  // GitHub-side setup is done (research/giscus-setup-steps.md).
  PUBLIC_GISCUS_REPO?: string;
  PUBLIC_GISCUS_REPO_ID?: string;
  PUBLIC_GISCUS_CATEGORY?: string;
  PUBLIC_GISCUS_CATEGORY_ID?: string;
  // Secrets (set via `wrangler secret put` / .dev.vars; optional at type level
  // because they are absent until configured).
  TURNSTILE_SECRET_KEY?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ACCOUNT_ID?: string;
  // Maintainer admin (R7 / ADR-11). In PRODUCTION the `/admin` route + the
  // `/api/admin/*` endpoints sit behind a Cloudflare Access (Zero Trust) policy,
  // and Access injects `Cf-Access-Authenticated-User-Email` on every authorized
  // request — the Worker just trusts that header (anonymous traffic never
  // reaches it). LOCAL dev has no Access edge, so `DEV_ADMIN_EMAIL` (from
  // .dev.vars) stands in: when set, the admin guard treats requests as coming
  // from that maintainer. NEVER set DEV_ADMIN_EMAIL in production — it would
  // bypass the edge gate. Absent → the guard denies (fail closed).
  DEV_ADMIN_EMAIL?: string;
}

// Astro v6 removed `Astro.locals.runtime.env`; bindings are now read via
// `import { env } from "cloudflare:workers"`, typed as `Cloudflare.Env`. We
// augment that interface with our wrangler.jsonc bindings here.
declare namespace Cloudflare {
  interface Env extends CloudflareEnv {}
}

declare namespace App {
  interface Locals {
    /** Active locale resolved by middleware. Sourced from i18n/config so new
     * locales stay in sync (inline import keeps this file ambient). */
    locale: import("./i18n/config").Locale;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_R2_BASE_URL?: string;
  readonly PUBLIC_GISCUS_REPO?: string;
  readonly PUBLIC_GISCUS_REPO_ID?: string;
  readonly PUBLIC_GISCUS_CATEGORY?: string;
  readonly PUBLIC_GISCUS_CATEGORY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

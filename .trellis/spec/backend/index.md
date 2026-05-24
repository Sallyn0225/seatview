# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains guidelines for backend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | To fill |
| [Error Handling](./error-handling.md) | Error types, handling strategies | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | To fill |
| [Database Guidelines](./database-guidelines.md) | Schema, soft-delete, upload write contract, ULID, rate-limit | **Filled (2026-05-24)** |

---

## Stack & Accepted Conventions (as-built 2026-05-24)

The PRD/research predate implementation; these are the **actual** backend
conventions. Do not "fix" them back toward the older docs without a deliberate
decision — each diverged for a verified reason.

- **Runtime env access**: Astro 6 dropped `Astro.locals.runtime.env`. Read
  Cloudflare bindings via `import { env } from "cloudflare:workers"`. The env
  shape is augmented onto `CloudflareEnv` in `src/env.d.ts`.
- **Adapter**: `@astrojs/cloudflare` v13 + Astro 6.3, `output: "server"`,
  Cloudflare **Workers** (NOT Pages — the Pages adapter is gone in Astro 6+).
- **Bindings**: `DB` (D1), `BUCKET` (R2 — name avoids the adapter's default
  Cloudflare Images binding), `RATE_LIMIT` (KV), and a **`SESSION` KV** the
  Astro CF adapter expects (declared in `wrangler.jsonc` even though there are
  no user accounts, ADR-2). Real ids are TODO placeholders for deploy.
- **Upload writes**: bound-bucket direct write + HMAC ticket (sign→commit), NOT
  presigned URLs. See database-guidelines.md.
- **ULID**: self-implemented (`src/server/id.ts`); the `ulid` package crashes in
  workerd. See database-guidelines.md.
- **Admin auth (CF Access)**: `/[lang]/admin` + `/api/admin/*` guarded in
  `src/middleware.ts` via `src/server/admin-auth.ts:maintainerEmail()` — reads
  the edge-injected `Cf-Access-Authenticated-User-Email` header in prod, falls
  back to `.dev.vars` `DEV_ADMIN_EMAIL` locally. Fail-closed (403). Routes
  ALSO re-check `maintainerEmail` (defense-in-depth vs edge misconfig).
- **IP privacy**: only salted SHA-256 `ip_hash` is ever stored (`src/server/ip.ts`); never the raw IP. No consent flag is stored (R11.4 — gating client-side is enough).
- **Local preview / deploy use the BUILT config, not the source config**. The
  root `wrangler.jsonc` has NO `main` — it only declares bindings/vars that the
  adapter inherits. `astro build` emits the runnable `dist/server/wrangler.json`
  (`main: entry.mjs` + an `ASSETS` binding). So `npm run preview` =
  `astro build && wrangler dev -c dist/server/wrangler.json` and `npm run deploy`
  = `astro build && wrangler deploy -c dist/server/wrangler.json`. A bare
  `wrangler dev` against the root config boots the adapter source entrypoint
  without ASSETS and SSR returns the literal `[object Object]` (config issue, not
  a Windows issue). Binding-management commands (`wrangler d1 migrations apply`,
  `wrangler kv namespace create`, `wrangler secret put`) still read the root
  `wrangler.jsonc`; the `db:*` scripts are unaffected by the missing `main`.

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.

# SeatView

[![Website](https://img.shields.io/badge/Website-seat.genchi.top-brightgreen)](https://seat.genchi.top) [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE) [![CI](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml/badge.svg)](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml)

<!-- README-I18N:START -->

[简体中文](./README.md) | **English** | [日本語](./README.ja.md) | [한국어](./README.ko.md)

<!-- README-I18N:END -->

> Before the lottery, the ticket rush, or the show itself — see what that seat can actually see.
> リアル座席ビュー · 真实视角图集 —— internal codename `seatmap-real`

**SeatView** aggregates **real seat-view photos** of concert venues in Japan (and some overseas). Users mark their own seat on a venue's official seating chart and upload a photo taken from that spot; others click a marker on the chart to preview that seat's real view in a Lightbox, or share a direct link to one specific view photo — making smarter decisions during a lottery, a ticket rush, or before the show.

Browsing, uploading, and anonymous ratings require **no SeatView registration**. Upload abuse is bounded with IP rate limiting + Cloudflare Turnstile; ratings are deduped and rate-limited by venue + salted IP hash; comments are powered by giscus on GitHub Discussions. The whole stack runs on Cloudflare alone: Workers (SSR + static assets) + D1 + KV + R2.

Live site 👉 **[seat.genchi.top](https://seat.genchi.top)**

[Preview](#preview) · [Features](#features) · [Tech Stack](#tech-stack) · [Quick Start](#quick-start) · [Deploy](#deploy-to-cloudflare) · [How It Works](#how-it-works) · [Project Structure](#project-structure) · [Contributing](#contributing)

## Preview

> Screenshots from the live site **[seat.genchi.top](https://seat.genchi.top)** (Simplified Chinese · light theme).

<p align="center">
  <img src="docs/screenshots/hero.png" alt="SeatView home page" width="88%">
</p>

The core experience is just two steps — **tap a seat on the seating chart → see the real view from that seat**:

<table>
  <tr>
    <th width="50%">① Seating-chart markers</th>
    <th width="50%">② Real-view Lightbox</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/seatmap.png" alt="Venue seating chart with markers" width="100%"></td>
    <td><img src="docs/screenshots/lightbox.jpg" alt="Seat real-view Lightbox" width="100%"></td>
  </tr>
  <tr>
    <td>View seat markers placed by other users on the venue's official seating chart (with multi-layer / multi-zone switching); adjacent markers auto-cluster and show a count.</td>
    <td>Click a marker or thumbnail to see that seat's actual photo + seat number / text description in the Lightbox.</td>
  </tr>
</table>

<table>
  <tr>
    <th width="40%">③ All submissions for a venue (masonry)</th>
    <th width="32%">Venues you want to see (crowdsourced staging)</th>
    <th width="28%">Dark theme</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/album.jpg" alt="Venue submission masonry feed" width="100%"></td>
    <td><img src="docs/screenshots/staging.png" alt="Venues you want to see staging area" width="100%"></td>
    <td><img src="docs/screenshots/seatmap-dark.png" alt="Dark-theme seating chart" width="100%"></td>
  </tr>
  <tr>
    <td>Below the seating chart, a masonry feed shows every real-view submission for that venue.</td>
    <td>Don't see the venue you want? Write down its name and others can +1 to second it.</td>
    <td>Light / dark / follow-system theme switching.</td>
  </tr>
</table>

## Features

- **Browse by prefecture** — the venue tree on the left is grouped and collapsible by Japanese administrative divisions; Fuse.js client-side fuzzy search matches Chinese / Japanese / romaji aliases.
- **Seating-chart markers** — view seat markers placed by other users on the venue's official seating chart (supports multi-layer / multi-zone tag switching); adjacent markers auto-cluster and show a count.
- **Real-view Lightbox** — click a marker to see that seat's actual photo + seat number / text description; a "nearby seats" strip at the bottom scrolls through same-cluster neighbors, and "locate on the seating chart" jumps back to the matching marker on the chart; the Lightbox reflects the current photo as `?photo=`, and the share button copies a venue / area-aware deep link; the masonry feed below shows every submission for that venue.
- **Venue photo counts** — under the venue title, current-area and whole-venue photo counts stay in sync when switching seating-chart areas or after a new upload.
- **Venue comments and ratings** — a quiet entry in the venue title area shows the overall score / rating count and opens a right drawer: anonymous four-dimension 1–5-star ratings on top (view, sound, amenities, transit; rating again changes your scores), giscus comments below, strictly mapped to `venue:<id>` and shared across locales and seating-chart tabs.
- **Registration-free uploads** — mark (with an optional full-screen zoom mode for precise placement) → pick image → compress to WebP client-side (EXIF stripped) → two-stage HMAC-ticket submission; in-line guidance nudges you through unfinished steps, with IP rate limiting + Turnstile guarding the whole flow.
- **Multilingual i18n** — `/zh` `/ja` `/en` `/ko` four-prefix routing; the bare root `/` auto-redirects by `Accept-Language` (zh / ja are equal tracks, while en / ko are an accessibility translation layer).
- **Venue crowdsourcing** — +1 a venue in the in-site "venues you want to see" staging area (public vote count + daily rate limit + name dedup), or submit venue JSON directly via a GitHub PR.
- **Maintainer admin** — `/admin` is edge-authenticated by Cloudflare Access and supports soft-deleting submissions.
- **SEO and AI discoverability** — every page emits a canonical + four-locale hreflang (incl. `x-default`); venue pages inject `MusicVenue` (with `aggregateRating` when there are enough ratings) / `BreadcrumbList` / seat-photo `ImageGallery` structured data, and the home page injects `WebSite` / `Organization`; the site root serves `/sitemap.xml` (locale × path + hreflang alternates) and `/llms.txt` (a plain-text venue index for AI), while low-value pages (staging / admin) are marked `noindex,follow`.

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | **Astro 6.4** + React 19.2 Islands | Mostly static; interactive components use React |
| Deploy adapter | **`@astrojs/cloudflare` v13.7** | Astro 6 no longer supports Cloudflare Pages, so it fully uses **Workers** (SSR + static assets in the same Worker) |
| Runtime bindings | **`import { env } from "cloudflare:workers"`** | Astro v6 removed `Astro.locals.runtime.env`; see `Cloudflare.Env` in `src/env.d.ts` for types |
| Styling | **Tailwind v4.3** (Vite plugin `@tailwindcss/vite`) | No standalone `tailwind.config`; design tokens live in `src/styles/global.css` |
| UI components | **All hand-written** (per `DESIGN.md` tokens) | No shadcn/ui-generated components |
| Icons | `lucide-react` | |
| Search | **Fuse.js** (full client-side) | ≤ 200 venues, in-bundle full search with zero latency |
| Database | **Cloudflare D1 + Drizzle ORM** | photos / staging / photo corrections / venue ratings; schema in `src/server/db/schema.ts`; migrations via `drizzle-kit generate` |
| Rate limiting | **Cloudflare KV** (`RATE_LIMIT`) | daily counts and cooldowns for upload, staging, seat-label corrections, and ratings; auto-expires via TTL |
| Image storage | **Cloudflare R2** (`BUCKET`) | **direct binding writes**, not presigned URLs |
| Bot defense | **Cloudflare Turnstile** | two steps: frontend token → backend siteverify |
| Comments | **giscus** + `@giscus/react` | GitHub Discussions-backed comments; the drawer lazy-loads on first open and follows the site light / dark theme |
| Anonymous ratings | **D1 aggregate table** + React island | Four-dimension 1–5-star ratings; `venue_id + ip_hash` dedupe, `venue_rating_agg` dimensional aggregate reads |
| Image processing | `browser-image-compression` | long edge 1920px / WebP / EXIF stripped / ~500KB |
| Lightbox | `yet-another-react-lightbox` v3 | |
| Masonry | Native CSS columns | Keeps real image ratios with no extra dependency |
| Seating-chart zoom | **`react-zoom-pan-pinch` v4.0** | programmatic zoom via `setTransform` / `resetTransform` |
| i18n | **Astro built-in i18n routing** | `/zh` `/ja` `/en` `/ko` four prefixes, bare root 302 |
| SEO / structured data | **hand-written JSON-LD + hreflang + sitemap / llms.txt** | `src/lib/seo/` (pure functions + unit tests): canonical / four-locale hreflang / `MusicVenue`·`Breadcrumb`·`ImageGallery` JSON-LD / `/sitemap.xml` / `/llms.txt` |
| ULID | **self-implemented** (`src/server/id.ts`) | not the `ulid` package (its `detectPrng()` throws on import under workerd) |

> [!NOTE]
> A few implementations **intentionally differ** from the early PRD / research descriptions; this repo is the source of truth. See [How It Works → Key Implementation Trade-offs](#key-implementation-trade-offs).

## Quick Start

> [!IMPORTANT]
> Prerequisite: **Node ≥ 22.12** (required by Astro 6).

```bash
# 1. Install dependencies
npm install

# 2. Prepare local secrets (defaults to Cloudflare's "always passes" Turnstile test key, works offline)
cp .dev.vars.example .dev.vars

# 3. (Optional) generate placeholder charts for newly added venues whose imageUrl points to .svg; shipped venues' charts come with the repo
npm run gen:seatmaps

# 4. Initialize local D1 (apply migrations)
npm run db:migrate:local

# 5. Generate and load demo markers (so the chart / masonry feed / Lightbox have content)
npm run gen:seed && npm run db:seed:local

# 6. Start the dev server
npm run dev        # Pure page dev, fastest HMR (D1/KV/R2 bindings and APIs unavailable)
# or
npm run preview    # Full features (bindings + APIs, via miniflare)
```

> [!TIP]
> Use `npm run dev` (fastest) for writing UI and tweaking styles. To test upload / staging / admin and other features that depend on Cloudflare bindings, use `npm run preview` (it runs `astro build` first, then `wrangler dev` pointing at the build output `dist/server/wrangler.json`, with miniflare providing D1/KV/R2 locally).

> [!WARNING]
> **Do not** run `wrangler dev` directly against the root `wrangler.jsonc` (i.e. without `-c`): the root config only declares bindings and has **no** `main`/`assets`, so it would start the adapter's source entry instead of the build output, causing every page's SSR to return the literal `[object Object]`. `npm run preview` / `npm run deploy` already point you at the correct config.

<details>
<summary><b>All npm scripts</b></summary>

| Command | Purpose |
|---|---|
| `npm run dev` | `astro dev`, page hot reload |
| `npm run build` | `astro build`, produces the Workers bundle into `dist/` |
| `npm run preview` | `astro build` then `wrangler dev -c dist/server/wrangler.json`, runs the build output + bindings locally |
| `npm test` | `node --experimental-strip-types --test`, runs pure logic tests |
| `npm run typecheck` | `astro check`, type checking |
| `npm run format` / `format:check` | Prettier format / check (CI uses `format:check`) |
| `npm run db:generate` | `drizzle-kit generate`, generate migrations from schema |
| `npm run db:migrate:local` / `:prod` | `wrangler d1 migrations apply` (local / remote) |
| `npm run gen:seatmaps` | generate placeholder seating-chart SVGs |
| `npm run gen:seed` | generate demo seed SQL |
| `npm run db:seed:local` | load demo seed into local D1 |
| `npm run cf-typegen` | `wrangler types`, generate binding types |
| `npm run deploy` | `astro build && wrangler deploy -c dist/server/wrangler.json` |

</details>

## Deploy to Cloudflare

Create the resources once, fill the returned ids into `wrangler.jsonc`, then migrate + deploy.

```bash
# 1. Create D1 / KV / R2 resources
wrangler d1 create seatmap-real
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create SESSION       # The Astro CF adapter requires a SESSION KV binding
wrangler r2 bucket create seatmap-images

# 2. Fill the returned real ids into wrangler.jsonc (placeholders YOUR_*):
#    d1_databases[0].database_id, kv_namespaces[].id (one each for RATE_LIMIT and SESSION)

# 3. Apply migrations to remote D1
npm run db:migrate:prod

# 4. Push the Turnstile production secret (do not commit it)
wrangler secret put TURNSTILE_SECRET_KEY
#    Put the site key into PUBLIC_TURNSTILE_SITE_KEY in .env.production (and sync wrangler.jsonc vars)

# 5. Configure giscus comments (public resource ids, not secrets)
#    Enable GitHub Discussions, install the giscus App, create the "Venue Comments" category,
#    then put PUBLIC_GISCUS_REPO / REPO_ID / CATEGORY / CATEGORY_ID into
#    .env.production and sync wrangler.jsonc vars

# 6. Deploy
npm run deploy
```

> [!NOTE]
> **Auto-deploy (CD)**: once configured, pushing to `main` triggers GitHub Actions to build and deploy to Cloudflare automatically (`.github/workflows/ci.yml`; deploy runs only after all checks pass, and you can also trigger it manually via "Run workflow" in the Actions tab). The `npm run deploy` above is for the first-time / local manual deploy.
>
> **One-time setup**: in the Cloudflare dashboard, create an API token with the "Edit Cloudflare Workers" template (Account = your account, Zone = `genchi.top`; if the custom domain fails on permissions, also add Zone → DNS: Edit), then add it as the repo secret `CLOUDFLARE_API_TOKEN` under GitHub repo → Settings → Secrets and variables → Actions.
>
> CD does **not** run D1 migrations; after a schema change you still run `npm run db:migrate:prod` manually.

> [!IMPORTANT]
> The **maintainer admin** (`/admin` + `/api/admin/*`) is protected at the edge by **Cloudflare Access (Zero Trust)**: in the dashboard, Zero Trust → Access → Applications, create a self-hosted app covering `/*/admin` and `/api/admin/*`, and add an Allow → maintainer-email policy. After Access authenticates, it injects `Cf-Access-Authenticated-User-Email`, and the Worker trusts that header (`src/server/admin-auth.ts`); anonymous traffic never reaches the Worker. Production needs **no** admin env vars; **never** set `DEV_ADMIN_EMAIL` in production — that would bypass the SSO gateway.

> [!NOTE]
> This repo already ships 74 Japanese / overseas venue entries (90 seating-chart image assets under `public/seatmaps/`) + demo markers. Real production markers are written to D1 by users via the upload flow. You only need to re-run `npm run db:migrate:prod` after changing the DB schema; pure frontend changes need no migration.

## How It Works

### Upload Flow (direct binding writes + HMAC ticket)

Instead of client-side direct upload via presigned URLs, it uses a **two-stage sign + commit** flow, ensuring D1 writes cannot be forged and that the whole thing can be rehearsed locally with miniflare R2 — no S3 credentials / bucket CORS needed:

1. **The client** marks a spot on the seating chart, picks an image, compresses it to a ~500KB WebP with `browser-image-compression` (long edge ≤ 1920, EXIF stripped), and passes Turnstile to get a token.
2. **`POST /api/upload/sign`** — the Worker validates Turnstile + 30s cooldown + 10/day cap (KV, keyed by the **hashed IP**), and issues an **HMAC ticket** binding all the fields that will be written (venue / sub-map / coordinates / seat number / `ip_hash` / `image_key` / expiry). This does **not** consume the daily quota yet.
3. **`POST /api/upload/commit`** (multipart) — the client sends the ticket + WebP bytes back. The Worker re-validates HMAC + expiry, writes the bytes to R2 via the `BUCKET` binding, then inserts into D1 **using the fields from the ticket** (not trusting the request body), and only then decrements the daily quota + starts the 30s cooldown.
4. Network errors / 5xx auto-retry, reusing the same ticket (and the already-consumed Turnstile token); 4xx (e.g. an expired ticket) does not retry.

Soft delete: when a maintainer deletes a photo in `/admin`, D1 sets `deleted_at` (public queries filter `deleted_at IS NULL`, so the marker / card disappears immediately), while the R2 object stays in the recycle bin and can be restored. Only "Delete forever" in the recycle bin physically deletes both the R2 object and the D1 row.

### Environment Variables / Bindings

| Name | Type | Purpose | Local | Production |
|---|---|---|---|---|
| `DB` | D1 | photos + staging_venues + photo_correction_requests + venue_ratings / venue_rating_agg | miniflare auto | real `database_id` in `wrangler.jsonc` |
| `BUCKET` | R2 | uploaded image storage (direct binding writes) | miniflare auto | `wrangler.jsonc` (`bucket_name`) |
| `RATE_LIMIT` | KV | IP rate-limit counting + cooldown (TTL), including upload / staging / seat-label corrections / ratings | miniflare auto | real KV id in `wrangler.jsonc` |
| `SESSION` | KV | binding required by the Astro CF adapter's session API (not actually written) | miniflare auto | real KV id in `wrangler.jsonc` |
| `TURNSTILE_SECRET_KEY` | secret | backend siteverify / HMAC ticket / IP-hash salt | `.dev.vars` (test secret) | `wrangler secret put` |
| `PUBLIC_TURNSTILE_SITE_KEY` | public var | frontend Turnstile widget | `.env.development` | `.env.production` (+ `wrangler.jsonc` vars runtime copy) |
| `PUBLIC_R2_BASE_URL` | public var | builds the uploaded image URL; empty → same-origin `/r2/<key>` fallback | `.env.development` (empty) | `.env.production` (r2.dev / custom domain) |
| `PUBLIC_SITE_URL` | public var | site base URL | `http://localhost:4321` | production domain |
| `PUBLIC_GISCUS_REPO` / `PUBLIC_GISCUS_REPO_ID` / `PUBLIC_GISCUS_CATEGORY` / `PUBLIC_GISCUS_CATEGORY_ID` | public var | giscus venue-comment config; when a required value is missing, the comments block shows an unavailable state and loads no third-party resources | `.env.development` | `.env.production` (+ `wrangler.jsonc` vars runtime copy) |
| `DEV_ADMIN_EMAIL` | local only | mock maintainer identity (when there's no Access edge) | `.dev.vars` (any email) | **never set** (use Cloudflare Access) |

> [!NOTE]
> `PUBLIC_*` is inlined into the client bundle by Vite at **build time** from `.env*` (islands read them via `import.meta.env.PUBLIC_*`) — **not** from `wrangler.jsonc`'s `vars` (those only reach the Worker runtime). Two mechanisms, two files; keep public values such as Turnstile, R2, and giscus in sync. R2 uploads need **no** S3 presigned credentials (`R2_ACCESS_KEY_ID` etc.); the Worker writes directly via the `BUCKET` binding.

### Venue Comments and Anonymous Ratings

The venue title area mounts the `VenueComments` island, which starts as a demoted entry chip (average / rating count / comments). `@giscus/react` is dynamically imported only when the drawer first opens; closing the drawer hides it instead of unmounting it, so the giscus iframe is not reloaded on reopen. giscus uses `mapping="specific"` + `term="venue:<id>"`, so the same venue shares one GitHub Discussions thread across locale paths and seating-chart tabs. Its theme follows the site's `html.dark` class instead of the system theme. If `PUBLIC_GISCUS_CATEGORY_ID` or another required value is empty, the comments block renders a "not available yet" state and loads no third-party script or iframe.

Anonymous ratings go through `POST /api/rating`, accepting only a static venue `venue.id` and a complete four-dimension 1–5-star score set: view, sound, amenities, and transit. They intentionally skip Turnstile (a rating should not trigger a challenge), but still use `TURNSTILE_SECRET_KEY` as the IP-hash salt. D1 stores one `venue_ratings` row per `venue_id + ip_hash`; rating again changes those four scores instead of adding another vote. `venue_rating_agg` stores the dimensional count / sum aggregate, and row writes plus aggregate updates happen in one `db.batch`. Venue SSR reads only that aggregate row and fails soft to an empty rating state if the read fails. KV limits only the number of new venues rated per day; changing an existing score does not consume quota.

### Photo Counts and Share Deep Links

The venue page SSR-reads the initial photos for the current sub-map and the per-area counts returned by `listVenuePhotoCounts`. `VenuePhotoCountLine` under the title shows either the total for a single-map venue or the "current area / whole venue" count for multi-map venues; sub-map fetches and successful uploads sync that line through the `seatview:photo-count-change` event.

Lightbox share links are photo-ULID authoritative: `/{locale}/v/{venueId}?tab=<subMapId>&photo=<photoId>`. When `?photo=` is present, the page does one primary-key lookup, confirms the photo is live and belongs to the current venue, uses the photo's own sub-map to override a stale `?tab=`, then auto-opens the Lightbox. Links that cannot resolve degrade to the normal venue page. While browsing, the Lightbox updates `?photo=` with `replaceState`, and the share button copies the current locale's short blurb + canonical link.

The Lightbox also has a "nearby seats" horizontal strip at the bottom (`NearbyStrip`, thumbnails of same-cluster neighbors); tapping a thumbnail switches straight to that neighbor's photo. The "locate on the seating chart" button closes the Lightbox, marks the current photo as selected, and scrolls / highlights the matching marker back on the chart.

### SEO and Structured Data / AI Discoverability

`Layout.astro` emits `<link rel="canonical">` and four-locale `hreflang` (`zh-Hans` / `ja` / `en` / `ko` + `x-default`, generated by `src/lib/seo/hreflang.ts`) on every page; `description` can be overridden per page, falling back to the site tagline. Low-value or gated pages (staging, admin) pass `noindex`, which emits `<meta name="robots" content="noindex,follow">` and skips hreflang.

Venue pages SSR-inject three JSON-LD blocks: `MusicVenue` (address / aliases, plus `aggregateRating` when the rating sample is large enough), `BreadcrumbList` (Home → Prefecture → Venue), and an `ImageGallery` of the venue's seat photos (each `ImageObject` with caption + CC license, giving crawlers a render-free image signal); the home page injects `WebSite` + `Organization`. The build logic lives in `src/lib/seo/jsonld-core.ts` (pure functions, with `*.test.ts`).

The site root also serves two SSR endpoints, both generated from the static `venues` array with zero D1 access: `/sitemap.xml` (one `<url>` per locale × path, with full-language `xhtml:link` alternates + `x-default`, and `<lastmod>` set to the build-time stamp `__BUILD_TIME__`, changing only on redeploy) and `/llms.txt` (an [llmstxt.org](https://llmstxt.org/)-style plain-text overview + every venue's canonical zh link, for AI crawling). `public/robots.txt` allows all UAs and points to the sitemap.

### Key Implementation Trade-offs

<details>
<summary>A few implementations that <b>intentionally differ</b> from the early PRD / research descriptions (expand)</summary>

1. **UI fully hand-written**, not generated by shadcn/ui.
2. **Uploads are "direct binding writes"** (the client sends the compressed WebP to the Worker, which writes to R2 via the `BUCKET` binding), with a two-stage sign + commit HMAC ticket preventing forgery — **not** client-side direct upload to R2 via presigned URLs.
3. **Astro v6** reads bindings via `import { env } from "cloudflare:workers"`, not `Astro.locals.runtime.env`.
4. **Tailwind v4 Vite plugin**, no standalone config, tokens in `src/styles/global.css`.
5. **`react-zoom-pan-pinch` v4.0**, still using `setTransform` / `resetTransform` to keep cluster-centering math explicit.
6. **ULID self-implemented** (`crypto.getRandomValues`), not the `ulid` package.
7. The R2 binding is named **`BUCKET`**, the rate-limit KV is **`RATE_LIMIT`**, plus a **`SESSION`** KV (required by the adapter's auto-enabled session API; SeatView has no account system and doesn't actually write sessions, but the binding must resolve); admin uses **Cloudflare Access** (the `Cf-Access-Authenticated-User-Email` header), mocked locally via `DEV_ADMIN_EMAIL` in `.dev.vars`.
8. **giscus comments are optional public config**: when `PUBLIC_GISCUS_*` is missing, no third-party resources load; once configured, comments map to GitHub Discussions by `venue:<id>`.
9. **Venue ratings are anonymous D1 aggregates**: `venue_ratings` stores the current four scores for each `venue_id + ip_hash`, and `venue_rating_agg` stores display aggregates; this is not GitHub reactions or social likes.
10. **Photo deep links treat `?photo=<ulid>` as authoritative**: `?tab=` is only readability and fallback; the server derives the sub-map from the photo row, so sub-map renames do not break shared links.

</details>

## Project Structure

```
seatmap-real/
├── astro.config.mjs          # Astro 6.4 + CF Workers adapter + Tailwind v4.3 Vite plugin + i18n
├── wrangler.jsonc            # CF bindings: DB(D1) / BUCKET(R2) / RATE_LIMIT,SESSION(KV) / vars
├── drizzle.config.ts         # drizzle-kit: generate migrations from schema into ./migrations
├── data/
│   ├── venues/<id>.json      # Static venue metadata, bundled at build time
│   └── _venue-template.json  # Contributor template (outside venues/, not bundled / seeded)
├── migrations/               # D1 migrations: photos / staging_votes / photo_corrections / venue_ratings
├── seeds/0001_demo_photos.sql# Local demo markers (script-generated, local only)
├── scripts/                  # Placeholder seating-chart / demo seed / coordinate migration scripts
├── public/seatmaps/<id>/...  # Maintainer-uploaded seating charts in WebP (not official copyrighted images)
└── src/
    ├── env.d.ts              # Cloudflare.Env binding types
    ├── middleware.ts         # Root 302 / locale resolution / admin guard
    ├── i18n/                 # locale config + copy
    ├── data/                 # venue tree + 47 prefectures
    ├── types/venue.ts        # Venue / SubMap / Photo / StagingVenue single source of truth
    ├── lib/                  # cross-layer contracts + client utilities (upload / staging / venue-rating / share / photo counts / transport; SEO helpers in lib/seo)
    ├── server/               # Worker side: db / photos / staging / ratings / rate-limit / turnstile / id / admin-auth / r2
    ├── pages/                # api/ (upload·staging·rating·admin·photos) + [lang]/ (home / venue / staging / admin / privacy / terms) + sitemap.xml / llms.txt (site-root SSR endpoints)
    └── styles/global.css     # Tailwind v4.3 + design tokens (OKLCH neutrals + vermilion accent)
```

## Contributing

There are two channels for adding new venues:

1. **Just submit a name** — the in-site "venues you want to see" page (`/zh/staging`, `/ja/staging`), where other users can +1. Lowest barrier.
2. **Add the data yourself** — GitHub Fork → edit `data/venues/<id>.json` → PR. An illustrated tutorial for non-coders and field descriptions are in **[CONTRIBUTING.md](CONTRIBUTING.md)**; the template is at [`data/_venue-template.json`](data/_venue-template.json).

> [!IMPORTANT]
> The site code is open-sourced under **Apache 2.0** (see [LICENSE](LICENSE)). Photos uploaded by users and their metadata are shared under **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)** — there's a mandatory consent checkbox before uploading. **Do not submit copyrighted official seating charts**: everything under `public/seatmaps/` is uploaded by the maintainer (not official copyrighted images).

## Acknowledgments

- **Tech community** — thanks to the [Linux Do](https://linux.do/) community for the discussions and help during development.
- **Seating-chart references** — venue seating charts were proofread with reference to [LiveKiti](https://livekiti.com/) and [LiveWalker](https://www.livewalker.com/).

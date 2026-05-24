# Research: Astro + Cloudflare Full-Stack Integration Best Practices

- **Query**: Complete Astro + Cloudflare stack configuration guide for SeatMap-Real project (SSR, D1, R2, KV, Turnstile, i18n, shadcn/ui)
- **Scope**: Internal + External (Astro docs, Cloudflare docs, production examples)
- **Date**: 2026-05-23

---

## 1. Astro + Cloudflare Deployment Architecture

### Recommended Architecture

**Option: Hybrid SSR on Cloudflare Workers (NOT Pages)**

Astro 6.0+ has moved away from Cloudflare Pages support. The official adapter now targets **Cloudflare Workers** only. Key reasons:
- Full SSR support (all pages rendered on-demand in Workers)
- Direct access to all Cloudflare bindings (D1, R2, KV, Turnstile)
- Better developer experience with `workerd` runtime in local development
- Automatic Image Optimization with `cloudflare-binding` mode

### Key Configuration Changes (Astro 6+)

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: 'server',  // Enable SSR (render all pages on-demand)
  adapter: cloudflare({
    platformProxy: {
      enabled: true,  // Enable local runtime (wrangler dev with workerd)
    },
    // Image optimization: use Cloudflare's native transform
    imageService: 'cloudflare-binding',
    // For prerendered pages that don't need Cloudflare APIs
    prerenderEnvironment: 'workerd',  // Match production (default)
  }),
  integrations: [react(), tailwind()],
});
```

### Environment Variables & Secrets

**Wrangler Configuration (wrangler.jsonc)**

```jsonc
{
  "name": "seatmap-real",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-05-23",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  
  // D1 Database Binding
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "seatmap-real",
      "database_id": "your-d1-id-here"
    }
  ],
  
  // R2 Bucket Binding
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "seatmap-images"
    }
  ],
  
  // KV Namespace for IP rate limiting
  "kv_namespaces": [
    {
      "binding": "RATE_LIMIT",
      "id": "your-kv-id"
    }
  ],
  
  // Public environment variables (build-time + runtime)
  "vars": {
    "PUBLIC_API_URL": "https://api.example.com",
    "TURNSTILE_SITE_KEY": "your-site-key"
  },
  
  // Environment-specific overrides
  "env": {
    "production": {
      "vars": {
        "PUBLIC_API_URL": "https://api.seatmap.com"
      }
    }
  }
}
```

**Local Development (.dev.vars)**

```bash
# Secrets and runtime-only env vars
TURNSTILE_SECRET_KEY=your-secret-key
ANTHROPIC_API_KEY=sk-...
```

**Access in Astro Code**

```typescript
// In .astro files and API endpoints
import type { APIContext } from 'astro';

export async function POST(context: APIContext) {
  // Runtime-only vars (from wrangler.toml vars or secrets)
  const dbBinding = context.locals.runtime.env.DB;
  const r2Binding = context.locals.runtime.env.IMAGES;
  const kvBinding = context.locals.runtime.env.RATE_LIMIT;
  
  // Or use Astro's astro:env API (modern approach)
  import { TURNSTILE_SECRET_KEY } from 'astro:env/server';
}
```

---

## 2. Cloudflare D1 Integration (SQLite at the Edge)

### ORM Recommendation: **Drizzle ORM**

**Why Drizzle over Kysely/Prisma?**
- Native D1 support with official adapter
- Type-safe migrations with `drizzle-kit`
- Excellent developer experience (schema-to-migration workflow)
- Smaller bundle than Prisma
- Works in edge environments

### Setup

**1. Install Dependencies**

```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

**2. Create Schema (src/db/schema.ts)**

```typescript
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at").default(new Date().toISOString()),
});

export const seats = sqliteTable("seats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  venueId: integer("venue_id").notNull(),
  seatNumber: text("seat_number").notNull(),
  row: text("row").notNull(),
  section: text("section"),
  available: integer("available").default(1),
});

export const seatReservations = sqliteTable("seat_reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seatId: integer("seat_id").notNull(),
  userId: integer("user_id").notNull(),
  concertId: integer("concert_id").notNull(),
  reservedAt: text("reserved_at").default(new Date().toISOString()),
  expiresAt: text("expires_at"),
});
```

**3. Drizzle Config (drizzle.config.ts)**

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: process.env.LOCAL_DB_PATH ? 'better-sqlite3' : 'd1-http',
  dbCredentials: {
    // Local development with better-sqlite3
    ...(process.env.LOCAL_DB_PATH && {
      url: process.env.LOCAL_DB_PATH,
    }),
    // Remote D1 via API
    ...(!process.env.LOCAL_DB_PATH && {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
      token: process.env.CLOUDFLARE_D1_TOKEN!,
    }),
  },
});
```

**4. Package.json Scripts**

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply seatmap-real --local",
    "db:migrate:prod": "wrangler d1 migrations apply seatmap-real --remote",
    "db:studio:local": "LOCAL_DB_PATH=$(find .wrangler/state -name '*.sqlite' -type f) drizzle-kit studio"
  }
}
```

**5. Use in Astro API Route**

```typescript
// src/pages/api/concerts.ts
import { drizzle } from 'drizzle-orm/d1';
import { seats, seatReservations } from '@/db/schema';
import type { APIContext } from 'astro';

export async function GET({ locals }: APIContext) {
  const db = drizzle(locals.runtime.env.DB);
  
  const availableSeats = await db
    .select()
    .from(seats)
    .where(eq(seats.available, 1))
    .limit(100);
  
  return new Response(JSON.stringify(availableSeats));
}
```

### Local Development

```bash
# Create local D1 database
wrangler d1 create seatmap-real --local

# Generate migration from schema
npm run db:generate

# Apply migration to local DB
npm run db:migrate:local

# View schema in Drizzle Studio
npm run db:studio:local
```

---

## 3. R2 Image Upload Strategy

### Recommended Architecture: **Direct Browser Upload with Presigned URLs**

**Why?**
- No 128 MB Worker memory limit (files stream directly)
- Cheaper (no Worker compute for upload streaming)
- Better UX (faster uploads, real progress tracking)
- User ~500KB compressed images = presigned URL is ideal

### Setup

**1. Create R2 Bucket + API Token**

```bash
# Create bucket
wrangler r2 bucket create seatmap-images

# Create API token with PutObject permission only
# Cloudflare Dashboard > R2 > API Tokens > Create Token
# - Permissions: Object Read & Write
# - Bucket: seatmap-images
```

**2. Configure CORS on R2 Bucket**

```bash
aws s3api put-bucket-cors \
  --bucket seatmap-images \
  --cors-configuration file://cors-policy.json \
  --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

**cors-policy.json:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://seatmap-real.example.com"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-version-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

**3. Worker Endpoint to Generate Presigned URL**

```typescript
// src/pages/api/upload-url.ts
import { AwsClient } from 'aws4fetch';
import type { APIContext } from 'astro';

export async function POST({ request, locals }: APIContext) {
  const { filename, contentType } = await request.json() as {
    filename: string;
    contentType: string;
  };

  // Generate unique key
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `venue-images/${timestamp}-${random}-${filename}`;

  // Create AWS4 signer
  const client = new AwsClient({
    accessKeyId: locals.runtime.env.R2_ACCESS_KEY_ID,
    secretAccessKey: locals.runtime.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  // Generate presigned PUT URL (valid 1 hour)
  const r2Url = `https://${locals.runtime.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/seatmap-images/${key}`;
  
  const signed = await client.sign(
    new Request(r2Url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
    }),
    {
      aws: { signQuery: true, expires: 3600 },
    }
  );

  return new Response(JSON.stringify({
    uploadUrl: signed.url.toString(),
    key,
    publicUrl: `https://cdn.seatmap-real.com/${key}`,
  }));
}
```

**4. Frontend React Component**

```typescript
// src/components/VenueImageUpload.tsx
import { useState } from 'react';

export default function VenueImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleUpload(file: File) {
    setUploading(true);

    // 1. Get presigned URL from Worker
    const urlRes = await fetch('/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
      }),
    });
    const { uploadUrl } = await urlRes.json();

    // 2. Upload directly to R2
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      console.log('Upload complete');
      setUploading(false);
    });

    xhr.send(file);
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && <progress value={progress} max={100}>{progress}%</progress>}
    </div>
  );
}
```

### Cost Savings

- **Without presigned**: 1000 image uploads × 500KB = 500GB Worker egress (~$50/month)
- **With presigned**: 1000 image uploads = direct to R2 = $0 egress (R2 is free)
- **Savings: ~$50/month or more at scale**

---

## 4. KV-Based IP Rate Limiting

### Recommended Algorithm: **Sliding Window Counter**

**Why?** Cloudflare's standard (0.003% error rate on 400M requests). Token bucket also valid.

### Implementation

**1. Create KV Namespace**

```bash
wrangler kv:namespace create "RATE_LIMIT"
wrangler kv:namespace create "RATE_LIMIT" --preview
```

**2. Add KV Binding to wrangler.jsonc**

```jsonc
"kv_namespaces": [
  {
    "binding": "RATE_LIMIT",
    "id": "your-kv-namespace-id",
    "preview_id": "your-preview-id"
  }
]
```

**3. Rate Limit Middleware**

```typescript
// src/lib/rate-limit.ts
import type { KVNamespace } from '@cloudflare/workers-types';

export interface RateLimitConfig {
  window: number;      // seconds (60 or 10)
  limit: number;       // max requests in window
  gracePeriod?: number; // seconds before enforcing limit
}

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - (config.window * 1000);
  
  // Sliding window counter: store [count, timestamp]
  const storedData = await kv.get(key);
  const { count, windowStartTime } = storedData
    ? JSON.parse(storedData)
    : { count: 0, windowStartTime: now };

  // Calculate decay based on sliding window
  const timeElapsed = (now - windowStartTime) / 1000;
  const decayedCount =
    timeElapsed >= config.window
      ? 1 // New window
      : count * ((config.window - timeElapsed) / config.window) + 1;

  const allowed = decayedCount <= config.limit;
  const remaining = Math.max(0, Math.floor(config.limit - decayedCount));
  const resetAt = windowStartTime + config.window * 1000;

  // Store in KV with expiry
  await kv.put(
    key,
    JSON.stringify({
      count: decayedCount,
      windowStartTime,
    }),
    {
      expirationTtl: config.window + 60, // TTL slightly longer than window
    }
  );

  return { allowed, remaining, resetAt };
}
```

**4. Use in API Endpoint**

```typescript
// src/pages/api/upload-image.ts
import { checkRateLimit } from '@/lib/rate-limit';
import type { APIContext } from 'astro';

export async function POST({ request, locals }: APIContext) {
  // Extract client IP (behind Cloudflare)
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

  // Check rate limit: 10 uploads per minute per IP
  const rateLimitKey = `upload:${clientIp}`;
  const limit = await checkRateLimit(locals.runtime.env.RATE_LIMIT, rateLimitKey, {
    window: 60,
    limit: 10,
  });

  if (!limit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      resetAt: limit.resetAt,
    }), {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
    });
  }

  // Process upload...
  return new Response(JSON.stringify({ success: true }));
}
```

### Multi-Layer Rate Limits

```typescript
// Combine multiple limits
const ipLimit = await checkRateLimit(kv, `upload:ip:${ip}`, {
  window: 60,
  limit: 10, // 10 uploads/minute per IP
});

const userLimit = await checkRateLimit(kv, `upload:user:${userId}`, {
  window: 3600,
  limit: 100, // 100 uploads/hour per user
});

const globalLimit = await checkRateLimit(kv, 'upload:global', {
  window: 60,
  limit: 1000, // 1000 uploads/minute globally
});

if (!ipLimit.allowed || !userLimit.allowed || !globalLimit.allowed) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

---

## 5. Cloudflare Turnstile CAPTCHA Integration

### Architecture: **Two-Step Validation with Human Token**

**Problem:** Turnstile tokens expire after 300s. Long form fills fail.  
**Solution:** Exchange token for short-lived JWT ("human token"), protect endpoints with JWT.

### Setup

**1. Create Turnstile Widget in Cloudflare Dashboard**

- Site name: `seatmap-real`
- Domains: `localhost:4321`, `seatmap-real.example.com`
- Mode: Managed Challenge (invisible + interaction-only)
- Appearance: Flexible

Copy:
- **Sitekey** → `PUBLIC_TURNSTILE_SITE_KEY`
- **Secret Key** → `TURNSTILE_SECRET_KEY`

**2. Frontend React Component**

```typescript
// src/components/TurnstileWidget.tsx
import { useRef, useEffect } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  autoExecute?: boolean;
}

export function TurnstileWidget({ onVerify, autoExecute = true }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.turnstile && containerRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
          execution: autoExecute ? 'render' : 'execute', // 'execute' = on-demand
          appearance: 'interaction-only',
          callback: (token) => onVerify(token),
        });
      }
    };

    return () => document.head.removeChild(script);
  }, [onVerify, autoExecute]);

  return <div ref={containerRef} className="cf-turnstile" />;
}
```

**3. API Endpoint to Exchange Token for JWT**

```typescript
// src/pages/api/turnstile/verify.ts
import jwt from '@tsnx/jwt';
import type { APIContext } from 'astro';

export async function POST({ request, locals }: APIContext) {
  const { turnstileToken } = await request.json();

  // Validate token with Cloudflare
  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: locals.runtime.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });

  const verification = await verifyRes.json() as {
    success: boolean;
    error_codes?: string[];
  };

  if (!verification.success) {
    return new Response(JSON.stringify({
      error: 'Verification failed',
      codes: verification.error_codes,
    }), { status: 400 });
  }

  // Generate short-lived JWT (5 minutes)
  const humanToken = await jwt.sign(
    {
      verified: true,
      iat: Math.floor(Date.now() / 1000),
    },
    locals.runtime.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  return new Response(JSON.stringify({ humanToken }), {
    headers: {
      'Set-Cookie': `human-token=${humanToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=300`,
    },
  });
}
```

**4. Protect API Endpoints with Middleware**

```typescript
// src/lib/verify-human.ts
import jwt from '@tsnx/jwt';
import type { APIContext } from 'astro';

export async function verifyHuman(context: APIContext): Promise<boolean> {
  const cookies = context.cookies.get('human-token')?.value;
  
  if (!cookies) return false;

  try {
    await jwt.verify(
      cookies,
      context.locals.runtime.env.JWT_SECRET
    );
    return true;
  } catch {
    return false;
  }
}

// Use in endpoint:
export async function POST(context: APIContext) {
  if (!await verifyHuman(context)) {
    return new Response('Human verification required', { status: 403 });
  }
  // Process request
}
```

**5. React Form Integration**

```typescript
// src/components/VenueForm.tsx
import { useRef, useState } from 'react';
import { TurnstileWidget } from './TurnstileWidget';

export function VenueForm() {
  const [humanToken, setHumanToken] = useState<string | null>(null);

  async function handleTurnstileVerify(token: string) {
    const res = await fetch('/api/turnstile/verify', {
      method: 'POST',
      body: JSON.stringify({ turnstileToken: token }),
    });
    const { humanToken } = await res.json();
    setHumanToken(humanToken);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!humanToken) {
      alert('Please verify with Turnstile');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/venues', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });

    if (res.ok) {
      alert('Venue created!');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" type="text" required />
      <textarea name="description" required />
      
      <TurnstileWidget onVerify={handleTurnstileVerify} autoExecute={false} />
      
      <button type="submit" disabled={!humanToken}>
        Create Venue
      </button>
    </form>
  );
}
```

---

## 6. Internationalization (i18n) Best Approach for SeatMap-Real

### Recommended: **Astro's Built-in i18n Router (v4.6+)**

**Why not manual?** Built-in handles fallback, locale detection, URL generation.

### Configuration

```javascript
// astro.config.mjs
export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'ja'],
    routing: {
      prefixDefaultLocale: false, // `/about` (en), `/zh/about` (zh), `/ja/about` (ja)
    },
    fallback: {
      ja: 'en', // Japanese pages fall back to English
    },
  },
});
```

### File Structure

```
src/pages/
├── index.astro                     # English home
├── about.astro                     # English about
└── [locale]/
    ├── index.astro                 # `/zh/`, `/ja/`
    ├── about.astro                 # `/zh/about`, `/ja/about`
    ├── concert/
    │   └── [id].astro              # `/zh/concert/[id]`, etc.
    └── venues.astro                # `/zh/venues`, `/ja/venues`
```

### Content Strategy: **Astro Content Collections**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    locale: z.enum(['en', 'zh', 'ja']),
    published: z.date().optional(),
  }),
});

export const collections = { pages };
```

**Content files:**
```
src/content/pages/
├── en/
│   ├── home.md
│   ├── about.md
│   └── venues.md
├── zh/
│   ├── home.md
│   ├── about.md
│   └── venues.md
└── ja/
    ├── home.md
    ├── about.md
    └── venues.md
```

**Dynamic Routes:**

```astro
---
// src/pages/[locale]/index.astro
import { getCollection } from 'astro:content';
import { getRelativeLocaleUrl } from 'astro:i18n';

export async function getStaticPaths() {
  const pages = await getCollection('pages');
  
  return pages.map((entry) => ({
    params: { locale: entry.data.locale },
    props: { entry },
  }));
}

const { locale } = Astro.params;
const { entry } = Astro.props;
const { Content } = await entry.render();
---

<Layout title={entry.data.title}>
  <h1>{entry.data.title}</h1>
  <Content />
  
  <nav>
    <a href={getRelativeLocaleUrl('en', '/')}>English</a>
    <a href={getRelativeLocaleUrl('zh', '/')}>中文</a>
    <a href={getRelativeLocaleUrl('ja', '/')}>日本語</a>
  </nav>
</Layout>
```

### Shared UI Translation (i18n JSON)

```typescript
// src/i18n/translations.ts
export const translations = {
  en: {
    nav: { home: 'Home', venues: 'Venues', contact: 'Contact' },
    seat: { available: 'Available', reserved: 'Reserved', selected: 'Selected' },
  },
  zh: {
    nav: { home: '首页', venues: '场馆', contact: '联系' },
    seat: { available: '可用', reserved: '已预订', selected: '已选中' },
  },
  ja: {
    nav: { home: 'ホーム', venues: ' 会場', contact: '連絡先' },
    seat: { available: '利用可能', reserved: '予約済み', selected: '選択済み' },
  },
};

export function getTranslation(locale: string) {
  return translations[locale as keyof typeof translations] || translations.en;
}
```

**Use in Components:**

```astro
---
import { getTranslation } from '@/i18n/translations';

const locale = Astro.params.locale || 'en';
const t = getTranslation(locale);
---

<nav>
  <a href="/">{t.nav.home}</a>
  <a href="/venues">{t.nav.venues}</a>
</nav>

<div class="seat available">{t.seat.available}</div>
```

---

## 7. shadcn/ui in Astro (React Islands)

### Setup

```bash
npx shadcn-ui@latest init
# Choose: TypeScript, ✓ Tailwind, ✓ CSS variables
```

### Configuration Files

**components.json:**
```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/global.css",
    "baseColor": "slate"
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

**Add Components:**

```bash
npx shadcn-ui@latest add button dialog form input select
```

### Component Usage in Astro

**Static (no interactivity):**

```astro
---
import { Button } from '@/components/ui/button';
---

<Button variant="outline">Click me</Button>
```

**Interactive (React Island):**

```astro
---
import BookingDialog from '@/components/BookingDialog';
---

<!-- client:load = hydrate immediately -->
<BookingDialog client:load />

<!-- OR for below-fold dialogs: -->
<BookingDialog client:visible />
```

**React Component:**

```typescript
// src/components/BookingDialog.tsx
import { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function BookingDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Book Seats</Button>
      </DialogTrigger>
      <DialogContent>
        <h2>Select Seats</h2>
        <Input placeholder="Email" />
        <Button onClick={() => setOpen(false)}>Confirm</Button>
      </DialogContent>
    </Dialog>
  );
}
```

### Tailwind Integration

**astro.config.mjs:**

```javascript
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
});
```

**Tailwind Config (v3):**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} as Config;
```

### Which shadcn Components Are Good as Islands?

| Component | Use as Island | Reason |
|-----------|---------------|--------|
| Button | No | Static HTML works |
| Dialog/Sheet | Yes | Needs state management |
| Form/Input | Yes | Needs React state |
| Accordion | Yes | Toggle state |
| Tabs | Yes | Active tab state |
| Tooltip | No | Can use CSS :hover |
| Card | No | Pure HTML |
| Badge | No | Pure HTML |
| Select | Yes | Needs React control |
| Popover | Yes | Hover + click state |

---

## 8. Common Pitfalls & Solutions

### Issue 1: Environment Variable Access

**Problem:** `import.meta.env` doesn't work in Astro with Cloudflare.

**Solution:** Use `Astro.locals.runtime.env` in `.astro` files and API routes:

```typescript
// ✓ Correct
const db = Astro.locals.runtime.env.DB;

// ✗ Wrong (returns undefined)
const db = import.meta.env.DB;
```

---

### Issue 2: Turnstile Token Expiry

**Problem:** Token expires after 300s; long form submissions fail.

**Solution:** Use execute-on-demand mode + JWT exchange:

```typescript
execution: 'execute',              // Don't render immediately
callback: () => solveChallenge(),  // Solve on form submit
```

---

### Issue 3: R2 CORS Failures

**Problem:** Browser upload to R2 returns 403.

**Solution:** Configure CORS + don't sign Content-Type header:

```typescript
// ✓ Correct: Don't include Content-Type in signature
const signed = await client.sign(
  new Request(url, { method: 'PUT' }),
  { aws: { signQuery: true } }
);

// ✗ Wrong: Including Content-Type causes signature mismatch
headers: { 'Content-Type': contentType }
```

---

### Issue 4: D1 Local Development

**Problem:** `.wrangler` folder location differs per OS.

**Solution:** Use `find` command in scripts:

```json
"db:studio": "LOCAL_DB_PATH=$(find .wrangler/state -name '*.sqlite' -type f -print -quit) drizzle-kit studio"
```

---

### Issue 5: KV Write Latency for Rate Limiting

**Problem:** KV writes have up to 60s propagation delay.

**Solution:** Use Durable Objects for strict rate limits OR accept eventual consistency:

```typescript
// For image uploads: eventual consistency is fine (60s delay acceptable)
// For login attempts: use Durable Objects + Workers Rate Limiting API
```

---

## 9. Astro Project Structure (Recommended for SeatMap-Real)

```
seatmap-real/
├── .github/workflows/
│   └── deploy.yml              # CD to Cloudflare Workers
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── VenueCard.astro     # Static Astro components
│   │   ├── BookingDialog.tsx   # React islands
│   │   └── SeatMap.tsx         # Interactive canvas
│   ├── content/
│   │   ├── config.ts           # Astro content config
│   │   └── pages/              # Multilingual markdown
│   │       ├── en/home.md
│   │       ├── zh/home.md
│   │       └── ja/home.md
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema
│   │   └── queries.ts          # Typed query helpers
│   ├── i18n/
│   │   └── translations.ts     # i18n JSON
│   ├── layouts/
│   │   └── Layout.astro        # Main layout
│   ├── lib/
│   │   ├── rate-limit.ts       # KV rate limiting
│   │   ├── turnstile.ts        # Turnstile helpers
│   │   └── utils.ts            # cn(), formatDate, etc.
│   ├── pages/
│   │   ├── api/                # SSR endpoints
│   │   │   ├── concerts.ts     # GET /api/concerts
│   │   │   ├── venues.ts       # POST /api/venues
│   │   │   ├── upload-url.ts   # POST /api/upload-url (R2 presigned)
│   │   │   └── turnstile/
│   │   │       └── verify.ts   # POST /api/turnstile/verify
│   │   ├── [locale]/           # i18n dynamic routes
│   │   │   ├── index.astro
│   │   │   ├── venues.astro
│   │   │   └── concert/
│   │   │       └── [id].astro
│   │   └── 404.astro
│   ├── styles/
│   │   └── global.css          # Tailwind + Turnstile styles
│   └── env.d.ts                # Cloudflare types
├── migrations/                  # Drizzle migrations
├── astro.config.mjs
├── drizzle.config.ts
├── wrangler.jsonc              # Cloudflare Workers config
├── tailwind.config.ts
├── components.json             # shadcn/ui config
├── tsconfig.json
├── .dev.vars                   # Local secrets (gitignore)
└── package.json
```

---

## 10. Implementation Checklist

### Phase 1: Setup & Scaffolding
- [ ] Create Astro + Cloudflare project with `create-cloudflare`
- [ ] Install `@astrojs/react`, `@astrojs/tailwind`
- [ ] Configure `wrangler.jsonc` with D1, R2, KV, Turnstile bindings
- [ ] Add `env.d.ts` types for runtime

### Phase 2: Database & ORM
- [ ] Install Drizzle ORM + `drizzle-kit`
- [ ] Define schema in `src/db/schema.ts`
- [ ] Generate migrations: `npm run db:generate`
- [ ] Create D1 database locally: `wrangler d1 create seatmap-real --local`
- [ ] Apply migrations: `npm run db:migrate:local`
- [ ] Test queries in Astro endpoints

### Phase 3: R2 Image Upload
- [ ] Create R2 bucket: `wrangler r2 bucket create seatmap-images`
- [ ] Create API token with PutObject scope
- [ ] Configure CORS on bucket
- [ ] Build `/api/upload-url` endpoint (presigned URL generator)
- [ ] Build React upload component with progress tracking
- [ ] Test browser upload flow

### Phase 4: IP Rate Limiting
- [ ] Create KV namespace: `wrangler kv:namespace create RATE_LIMIT`
- [ ] Implement sliding window counter in `src/lib/rate-limit.ts`
- [ ] Apply to `/api/upload-image` endpoint (10 per minute per IP)
- [ ] Test with curl/Postman

### Phase 5: Turnstile Integration
- [ ] Create Turnstile site in Cloudflare dashboard
- [ ] Copy sitekey & secret to `wrangler.jsonc`
- [ ] Build Turnstile React component
- [ ] Build `/api/turnstile/verify` endpoint (exchange for JWT)
- [ ] Protect endpoints with `verifyHuman` middleware
- [ ] Test flow: render widget → verify → get human token

### Phase 6: i18n Setup
- [ ] Configure i18n in `astro.config.mjs` (en/zh/ja)
- [ ] Create file structure: `[locale]/pages/`
- [ ] Add translations JSON in `src/i18n/translations.ts`
- [ ] Build `getTranslation()` helper
- [ ] Test URL generation: `/zh/about`, `/ja/about`

### Phase 7: UI Components
- [ ] Initialize shadcn/ui: `npx shadcn-ui@latest init`
- [ ] Add buttons, dialogs, forms, inputs
- [ ] Create React islands for interactive components
- [ ] Use `client:visible` for below-fold dialogs
- [ ] Test build with `astro build`

### Phase 8: Testing & Deployment
- [ ] Run local dev: `astro dev`
- [ ] Test SSR with: `npm run preview` (wrangler pages dev)
- [ ] Verify all bindings work locally (D1, R2, KV, Turnstile)
- [ ] Push to Git
- [ ] Deploy to Cloudflare Workers: `npm run deploy`

---

## External References

### Core Documentation

- **Astro Cloudflare Adapter** (v6+): https://docs.astro.build/en/guides/integrations-guide/cloudflare/
  - New entrypoint: `@astrojs/cloudflare/entrypoints/server`
  - Optional `wrangler.jsonc` for simple projects
  
- **Cloudflare D1**: https://developers.cloudflare.com/d1/
  - Type inference with `wrangler types`
  - Local SQLite development with `.wrangler/state`
  
- **Cloudflare R2**: https://developers.cloudflare.com/r2/
  - Presigned URLs (no AWS SDK, use `aws4fetch`)
  - Zero egress cost

- **Cloudflare Turnstile**: https://developers.cloudflare.com/turnstile/
  - Managed Challenge (default, recommended)
  - Invisible mode (execution: execute, not recommended)

- **Astro i18n**: https://docs.astro.build/en/guides/internationalization/
  - Built-in router (v4.6+, not experimental in v6)
  - Fallback languages per locale

### Community & Examples

- **Drizzle + D1**: https://orm.drizzle.team/docs/get-started/d1-existing
  - Best ORM for D1
  - Schema → migration → query pipeline

- **shadcn/ui + Astro**: https://ui.shadcn.com/docs/installation/astro
  - React islands with `client:*` directives
  - Works with Tailwind v3 & v4

- **Presigned URL patterns** (Liran Tal): https://lirantal.com/blog/pre-signed-url-upload-architecture-cloudflare-r2-hono-workers
  - Secure direct browser uploads
  - Cost optimization

- **Rate Limiting Algorithms** (HLD Handbook): https://hld.handbook.academy/trade-offs/rate-limiting-algorithms/
  - Sliding window counter: 0.003% error at Cloudflare scale
  - Token bucket: for APIs with burst tolerance

---

## Caveats & Known Issues

### Astro 6 Breaking Changes

1. **Pages support removed**: Only Workers now. Pages users should migrate.
2. **Entrypoint changed**: `main` field now points to `@astrojs/cloudflare/entrypoints/server` (auto-generated).
3. **Wrangler is optional**: If no custom bindings, no `wrangler.jsonc` needed.
4. **Build-time env vars**: `import.meta.env` only works for `PUBLIC_*` prefixed vars at build-time.

### D1 Limitations

- SQLite at the edge (not Postgres)
- No full-text search, JSON operators, or advanced features
- Good for: CRUD, simple queries
- Not good for: Complex analytics, full-text search

### R2 CORS Gotchas

- Browser uploads require explicit CORS configuration
- Don't sign `Content-Type` header (browser can't match signature)
- `X-Amz-Meta-*` headers require CORS whitelist

### KV Rate Limiting

- ~60s propagation delay (eventual consistency)
- Per-PoP counters (not global)
- Use Durable Objects for strict limits

### Turnstile Token Lifetime

- 300s (5 minutes) default expiry
- Can't extend without re-solving challenge
- Must use JWT exchange for long-lived sessions


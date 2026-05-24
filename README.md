# SeatView

[![Website](https://img.shields.io/badge/Website-seat.genchi.top-brightgreen)](https://seat.genchi.top) [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE) [![CI](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml/badge.svg)](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml)

<!-- README-I18N:START -->

**简体中文** | [English](./README.en.md) | [日本語](./README.ja.md)

<!-- README-I18N:END -->

> 抢票选座前，先看看那个座位到底能看到什么。
> リアル座席ビュー · 真实视角图集 —— 内部代号 `seatmap-real`

**SeatView** 聚合日本（含部分海外）演唱会场馆的**真实座位视角照片**。用户在场馆官方坐席图上标注自己的座位、上传该位置的实拍照片；其他人点击坐席图上的标注点，就能在 Lightbox 里预览那个座位的真实视角——在抢票、选座前做出更明智的决定。

浏览与上传**均无需注册**，靠 IP 限频 + Cloudflare Turnstile 防滥用。全栈只跑在 Cloudflare 一家：Workers（SSR + 静态资源）+ D1 + KV + R2。

线上站点 👉 **[seat.genchi.top](https://seat.genchi.top)**

[功能特性](#功能特性) · [技术栈](#技术栈) · [快速开始](#快速开始) · [部署](#部署到-cloudflare) · [工作原理](#工作原理) · [项目结构](#项目结构) · [贡献](#贡献)

## 功能特性

- **按都道府县浏览** —— 左侧场馆树按日本行政区划分组、可折叠；Fuse.js 客户端模糊搜索，中文 / 日文 / 罗马字别名都能命中。
- **坐席图标注** —— 在场馆官方坐席图（支持多层 / 多分区 tag 切换）上查看其他用户标注的座位点，相邻点自动聚合并显示数量。
- **真实视角 Lightbox** —— 点标注点即可查看该座位的实拍照片 + 座位号 / 文字描述；下方瀑布流展示该场馆的全部投稿。
- **免注册上传** —— 标点 → 选图 → 客户端压成 WebP（去 EXIF）→ HMAC ticket 两段式提交，全程 IP 限频 + Turnstile 防滥用。
- **双语 i18n** —— `/zh` 与 `/ja` 双前缀路由，裸根 `/` 按 `Accept-Language` 自动重定向。
- **场馆众包** —— 站内「想看的场馆」暂存区可 +1，或通过 GitHub PR 直接提交场馆 JSON。
- **维护者后台** —— `/admin` 由 Cloudflare Access 边缘鉴权，支持软删除投稿。

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | **Astro 6.3** + React 19 Islands | 大部分静态化，交互组件用 React |
| 部署适配器 | **`@astrojs/cloudflare` v13** | Astro 6 已不支持 Cloudflare Pages，全面用 **Workers**（SSR + 静态资源同一个 Worker） |
| 运行时绑定 | **`import { env } from "cloudflare:workers"`** | Astro v6 移除了 `Astro.locals.runtime.env`；类型见 `src/env.d.ts` 的 `Cloudflare.Env` |
| 样式 | **Tailwind v4**（Vite 插件 `@tailwindcss/vite`） | 无独立 `tailwind.config`；设计 token 写在 `src/styles/global.css` |
| UI 组件 | **全部手写**（按 `DESIGN.md` token） | `components.json` 虽在，但 UI 并非 shadcn/ui 生成 |
| 图标 | `lucide-react` | |
| 搜索 | **Fuse.js**（客户端全量） | 场馆 ≤ 200，bundle 内全量搜索零延迟 |
| 数据库 | **Cloudflare D1 + Drizzle ORM** | schema 见 `src/server/db/schema.ts`；迁移用 `drizzle-kit generate` |
| 限频 | **Cloudflare KV**（`RATE_LIMIT`） | 每日计数 + 30s 冷却，带 TTL 自动过期 |
| 图片存储 | **Cloudflare R2**（`BUCKET`） | **绑定直写**，不是 presigned URL |
| 防机器人 | **Cloudflare Turnstile** | 两步：前端 token → 后端 siteverify |
| 图片处理 | `browser-image-compression` | 长边 1920px / WebP / 去 EXIF / ~500KB |
| Lightbox | `yet-another-react-lightbox` v3 | |
| 瀑布流 | `react-photo-album`（masonry） | |
| 坐席图缩放 | **`react-zoom-pan-pinch` v3.7** | 用 `setTransform` / `resetTransform` 程序化缩放 |
| i18n | **Astro 内置 i18n 路由** | `/zh` 与 `/ja` 双前缀，裸根 302 |
| ULID | **自实现**（`src/server/id.ts`） | 不用 `ulid` 包（它 import 时 `detectPrng()` 在 workerd 抛错） |

> [!NOTE]
> 几处实现与早期 PRD / research 描述**有意不同**，以本仓库为准。详见 [工作原理 → 关键实现取舍](#关键实现取舍)。

## 快速开始

> [!IMPORTANT]
> 前置：**Node ≥ 22.12**（Astro 6 要求）。

```bash
# 1. 安装依赖
npm install

# 2. 准备本地密钥（默认用 Cloudflare 文档里的「永远通过」Turnstile 测试 key，可离线演练）
cp .dev.vars.example .dev.vars

# 3. 生成本地占位坐席图（首次或新增场馆后）
npm run gen:seatmaps

# 4. 初始化本地 D1（应用迁移）
npm run db:migrate:local

# 5. 生成并灌入 demo 标注点（让坐席图 / 瀑布流 / Lightbox 有内容）
npm run gen:seed && npm run db:seed:local

# 6. 启动开发服务器
npm run dev        # 纯页面开发，最快 HMR（D1/KV/R2 绑定与 API 不可用）
# 或
npm run preview    # 全功能（含绑定 + API，走 miniflare）
```

> [!TIP]
> 写 UI、调样式用 `npm run dev`（最快）。要联调上传 / 暂存 / 后台等依赖 Cloudflare 绑定的功能，用 `npm run preview`（先 `astro build`，再 `wrangler dev` 指向构建产物 `dist/server/wrangler.json`，本地由 miniflare 提供 D1/KV/R2）。

> [!WARNING]
> **不要**直接对根 `wrangler.jsonc` 跑 `wrangler dev`（即不带 `-c`）：根配置只声明绑定、**没有** `main`/`assets`，会启动适配器源入口而非构建产物，导致所有页面 SSR 返回字面量 `[object Object]`。`npm run preview` / `npm run deploy` 已替你指向正确的配置。

<details>
<summary><b>全部 npm 脚本</b></summary>

| 命令 | 作用 |
|---|---|
| `npm run dev` | `astro dev`，页面热更新 |
| `npm run build` | `astro build`，产出 Workers bundle 到 `dist/` |
| `npm run preview` | `astro build` 后 `wrangler dev -c dist/server/wrangler.json`，本地跑构建产物 + 绑定 |
| `npm run typecheck` | `astro check`，类型检查 |
| `npm run db:generate` | `drizzle-kit generate`，从 schema 生成迁移 |
| `npm run db:migrate:local` / `:prod` | `wrangler d1 migrations apply`（本地 / 远程） |
| `npm run gen:seatmaps` | 生成占位坐席图 SVG |
| `npm run gen:seed` | 生成 demo 种子 SQL |
| `npm run db:seed:local` | 把 demo 种子灌入本地 D1 |
| `npm run cf-typegen` | `wrangler types`，生成绑定类型 |
| `npm run deploy` | `astro build && wrangler deploy -c dist/server/wrangler.json` |

</details>

## 部署到 Cloudflare

一次性创建资源、把返回的 id 填进 `wrangler.jsonc`，再迁移 + 部署。

```bash
# 1. 创建 D1 / KV / R2 资源
wrangler d1 create seatmap-real
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create SESSION       # Astro CF 适配器要求一个 SESSION KV 绑定
wrangler r2 bucket create seatmap-images

# 2. 把返回的真实 id 填进 wrangler.jsonc（占位符 YOUR_*）：
#    d1_databases[0].database_id、kv_namespaces[].id（RATE_LIMIT 与 SESSION 各一个）

# 3. 应用迁移到远程 D1
npm run db:migrate:prod

# 4. 下发 Turnstile 生产密钥（不要写进仓库）
wrangler secret put TURNSTILE_SECRET_KEY
#    site key 填进 .env.production 的 PUBLIC_TURNSTILE_SITE_KEY（并同步 wrangler.jsonc vars）

# 5. 部署
npm run deploy
```

> [!IMPORTANT]
> **维护者后台**（`/admin` + `/api/admin/*`）由 **Cloudflare Access (Zero Trust)** 在边缘保护：在控制台 Zero Trust → Access → Applications 新建 self-hosted 应用覆盖 `/*/admin` 与 `/api/admin/*`，加一条 Allow → 维护者邮箱的 policy。Access 鉴权后注入 `Cf-Access-Authenticated-User-Email`，Worker 信任该头（`src/server/admin-auth.ts`），匿名流量到不了 Worker。生产**无需**任何 admin 环境变量；**切勿**在生产设 `DEV_ADMIN_EMAIL`——那会绕过 SSO 网关。

> [!NOTE]
> 本仓库已带 7 个高频场馆 + demo 标注。生产的真实标注由用户通过上传流程写入 D1。改了 DB schema 才需要重新跑 `npm run db:migrate:prod`；纯前端改动无需迁移。

## 工作原理

### 上传流程（绑定直写 + HMAC ticket）

不是 presigned URL 客户端直传，而是 **sign + commit 两段式**，确保 D1 写入不可伪造，且本地 miniflare R2 即可全程演练、无需 S3 凭证 / 桶 CORS：

1. **客户端**在坐席图上标点、选图，用 `browser-image-compression` 压成 ~500KB WebP（长边 ≤ 1920、去 EXIF），并过 Turnstile 拿 token。
2. **`POST /api/upload/sign`** —— Worker 校验 Turnstile + 30s 冷却 + 10/天上限（KV，键用**哈希后的 IP**），签发一张 **HMAC ticket**，绑定将写入的全部字段（venue / sub-map / 坐标 / 座位号 / `ip_hash` / `image_key` / 过期时间）。此时**不**消耗每日配额。
3. **`POST /api/upload/commit`**（multipart）—— 客户端把 ticket + WebP 字节发回。Worker 重新校验 HMAC + 过期，将字节经 `BUCKET` 绑定写入 R2，再**用 ticket 里的字段**（不信任请求体）插入 D1，最后才扣每日配额 + 启动 30s 冷却。
4. 网络错误 / 5xx 自动重试，复用同一 ticket（与已消费的 Turnstile token）；4xx（如 ticket 过期）不重试。

软删除：维护者在 `/admin` 软删时，D1 置 `deleted_at`（公共查询过滤 `deleted_at IS NULL`，标注点 / 卡片立即消失）并物理删除 R2 对象。

### 环境变量 / 绑定

| 名称 | 类型 | 用途 | 本地 | 生产 |
|---|---|---|---|---|
| `DB` | D1 | photos + staging_venues | miniflare 自动 | `wrangler.jsonc` 填真实 `database_id` |
| `BUCKET` | R2 | 上传图片存储（绑定直写） | miniflare 自动 | `wrangler.jsonc`（`bucket_name`） |
| `RATE_LIMIT` | KV | IP 限频计数 + 冷却（TTL） | miniflare 自动 | `wrangler.jsonc` 填真实 KV id |
| `SESSION` | KV | Astro CF 适配器 session API 要求的绑定（不实际写） | miniflare 自动 | `wrangler.jsonc` 填真实 KV id |
| `TURNSTILE_SECRET_KEY` | 密钥 | 后端 siteverify | `.dev.vars`（测试 secret） | `wrangler secret put` |
| `PUBLIC_TURNSTILE_SITE_KEY` | 公共 var | 前端 Turnstile widget | `.env.development` | `.env.production`（+ `wrangler.jsonc` vars 运行时副本） |
| `PUBLIC_R2_BASE_URL` | 公共 var | 拼接上传图片 URL；空 → 同源 `/r2/<key>` 兜底 | `.env.development`（空） | `.env.production`（r2.dev / 自定义域名） |
| `PUBLIC_SITE_URL` | 公共 var | 站点基址 | `http://localhost:4321` | 生产域名 |
| `DEV_ADMIN_EMAIL` | 仅本地 | mock 维护者身份（无 Access 边缘时） | `.dev.vars`（任意邮箱） | **绝不设置**（用 Cloudflare Access） |

> [!NOTE]
> `PUBLIC_*` 由 Vite 在**构建期**从 `.env*` 内联进客户端 bundle（islands 通过 `import.meta.env.PUBLIC_*` 读取）——**不**来自 `wrangler.jsonc` 的 `vars`（那只到 Worker 运行时）。两套机制、两份文件，记得保持同步。R2 上传**不需要** S3 presigned 凭证（`R2_ACCESS_KEY_ID` 等），Worker 经 `BUCKET` 绑定直写。

### 关键实现取舍

<details>
<summary>几处与早期 PRD / research 描述<b>有意不同</b>的实现（展开）</summary>

1. **UI 全手写**，不是 shadcn/ui 生成。
2. **上传是「绑定直写」**（客户端把压好的 WebP 发给 Worker，Worker 用 `BUCKET` 绑定写 R2），用 HMAC ticket 的 sign + commit 两段式防伪——**不是** presigned URL 客户端直传 R2。
3. **Astro v6** 读绑定用 `import { env } from "cloudflare:workers"`，不是 `Astro.locals.runtime.env`。
4. **Tailwind v4 Vite 插件**，无独立 config，token 在 `src/styles/global.css`。
5. **`react-zoom-pan-pinch` v3.7**，用 `setTransform` / `resetTransform`（v3.7 没有 v4 的 `zoomTo`）。
6. **ULID 自实现**（`crypto.getRandomValues`），不用 `ulid` 包。
7. R2 绑定名是 **`BUCKET`**、限频 KV 是 **`RATE_LIMIT`**，另有 **`SESSION`** KV（适配器自动启用 session API 所需，SeatView 无账号系统、不实际写 session，但绑定需可解析）；admin 用 **Cloudflare Access**（`Cf-Access-Authenticated-User-Email` 头），本地用 `.dev.vars` 的 `DEV_ADMIN_EMAIL` mock。

</details>

## 项目结构

```
seatmap-real/
├── astro.config.mjs          # Astro 6 + CF Workers 适配器 + Tailwind v4 Vite 插件 + i18n
├── wrangler.jsonc            # CF 绑定：DB(D1) / BUCKET(R2) / RATE_LIMIT,SESSION(KV) / vars
├── drizzle.config.ts         # drizzle-kit：从 schema 生成迁移到 ./migrations
├── data/
│   ├── venues/<id>.json      # 静态场馆元数据，构建时打进 bundle
│   └── _venue-template.json  # 贡献者样板（在 venues/ 之外，不进 bundle / 种子）
├── migrations/0000_init.sql  # D1 初始 schema（photos + staging_venues）
├── seeds/0001_demo_photos.sql# 本地 demo 标注点（脚本生成，仅本地）
├── scripts/                  # 占位坐席图 / demo 种子生成脚本
├── public/seatmaps/<id>/...  # 占位坐席图 SVG（非真实版权图）
└── src/
    ├── env.d.ts              # Cloudflare.Env 绑定类型
    ├── middleware.ts         # 根 302 / locale 解析 / admin 守卫
    ├── i18n/                 # locale 配置 + 文案
    ├── data/                 # 场馆树 + 47 都道府县
    ├── types/venue.ts        # Venue / SubMap / Photo / StagingVenue 单一真源
    ├── lib/                  # 跨层契约 + 客户端工具
    ├── server/               # Worker 侧：db / photos / staging / rate-limit / turnstile / id / admin-auth / r2
    ├── pages/                # api/（upload·staging·admin·photos）+ [lang]/（首页 / 场馆页 / 暂存区 / 后台）
    └── styles/global.css     # Tailwind v4 + 设计 token（OKLCH 中性色 + 朱赤 accent）
```

## 贡献

补充新场馆有两条通道：

1. **只报名字** —— 站内「想看的场馆」页（`/zh/staging`、`/ja/staging`），其他用户可 +1。门槛最低。
2. **自己加数据** —— GitHub Fork → 编辑 `data/venues/<id>.json` → PR。面向非编码者的图文教程、字段说明见 **[CONTRIBUTING.md](CONTRIBUTING.md)**，样板见 [`data/_venue-template.json`](data/_venue-template.json)。

> [!IMPORTANT]
> 站点代码以 **Apache 2.0** 开源（见 [LICENSE](LICENSE)）。用户上传的照片及其元数据以 **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)** 共享——上传前有强制勾选的同意框。**请勿提交有版权的官方坐席图**：`public/seatmaps/` 下全部是本地自绘的占位图。

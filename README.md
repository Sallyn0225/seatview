# SeatView

[![Website](https://img.shields.io/badge/Website-seat.genchi.top-brightgreen)](https://seat.genchi.top) [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE) [![CI](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml/badge.svg)](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml)

<!-- README-I18N:START -->

**简体中文** | [English](./README.en.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

<!-- README-I18N:END -->

> 抽选、抢票，还是开演前确认座位号——先看看那个座位到底能看到什么。
> リアル座席ビュー · 真实视角图集 —— 内部代号 `seatmap-real`

**SeatView** 聚合日本（含部分海外）演唱会场馆的**真实座位视角照片**。用户在场馆官方坐席图上标注自己的座位、上传该位置的实拍照片；其他人点击坐席图上的标注点，就能在 Lightbox 里预览那个座位的真实视角，也可以直接分享某一张视角照片链接——在抽选、抢票或开演前确认座位时做出更明智的决定。

浏览、上传和匿名评分**均无需 SeatView 注册**。上传靠 IP 限频 + Cloudflare Turnstile 防滥用；评分按场馆 + 盐化 IP hash 去重并限流；评论通过 giscus 接入 GitHub Discussions。全栈只跑在 Cloudflare 一家：Workers（SSR + 静态资源）+ D1 + KV + R2。

线上站点 👉 **[seat.genchi.top](https://seat.genchi.top)**

[预览](#预览) · [功能特性](#功能特性) · [技术栈](#技术栈) · [快速开始](#快速开始) · [部署](#部署到-cloudflare) · [工作原理](#工作原理) · [项目结构](#项目结构) · [贡献](#贡献)

## 预览

> 以下截图取自线上站点 **[seat.genchi.top](https://seat.genchi.top)**（简体中文 · 亮色主题）。

<p align="center">
  <img src="docs/screenshots/hero.png" alt="SeatView 首页" width="88%">
</p>

核心体验只有两步——**在坐席图上点一个座位 → 看那个座位实拍的现场**：

<table>
  <tr>
    <th width="50%">① 坐席图标注点</th>
    <th width="50%">② 真实视角 Lightbox</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/seatmap.png" alt="场馆坐席图与标注点" width="100%"></td>
    <td><img src="docs/screenshots/lightbox.jpg" alt="座位真实视角 Lightbox" width="100%"></td>
  </tr>
  <tr>
    <td>在场馆官方坐席图（支持多层 / 多分区切换）上查看其他用户标注的座位点，相邻点自动聚合并显示数量。</td>
    <td>点标注点或缩略图，在 Lightbox 里查看该座位的实拍现场 + 座位号 / 文字描述。</td>
  </tr>
</table>

<table>
  <tr>
    <th width="40%">③ 场馆全部投稿（瀑布流）</th>
    <th width="32%">想看的场馆（众包暂存区）</th>
    <th width="28%">暗色主题</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/album.jpg" alt="场馆投稿瀑布流" width="100%"></td>
    <td><img src="docs/screenshots/staging.png" alt="想看的场馆暂存区" width="100%"></td>
    <td><img src="docs/screenshots/seatmap-dark.png" alt="暗色主题坐席图" width="100%"></td>
  </tr>
  <tr>
    <td>坐席图下方以 masonry 瀑布流展示该场馆的全部真实视角投稿。</td>
    <td>没有想看的场馆？写下名字，其他人可 +1 附议。</td>
    <td>亮 / 暗 / 跟随系统三档主题切换。</td>
  </tr>
</table>

## 功能特性

- **按都道府县浏览** —— 左侧场馆树按日本行政区划分组、可折叠；Fuse.js 客户端模糊搜索，中文 / 日文 / 罗马字别名都能命中。
- **坐席图标注** —— 在场馆官方坐席图（支持多层 / 多分区 tag 切换）上查看其他用户标注的座位点，相邻点自动聚合并显示数量。
- **真实视角 Lightbox** —— 点标注点即可查看该座位的实拍照片 + 座位号 / 文字描述；底部「附近座位」预览条可横滑切换同簇邻座，「在坐席图中定位」一键跳回坐席图上对应标注点；Lightbox 会把当前照片同步到地址栏 `?photo=`，分享按钮复制带场馆 / 区域文案的深链；下方瀑布流展示该场馆的全部投稿。
- **场馆投稿统计** —— 场馆标题下方显示当前区域与全场馆照片数，切换坐席图分区或新上传后即时更新。
- **场馆评论与评分** —— 场馆页标题区的轻量入口显示综合分 / 评分数并打开右侧抽屉：上方是匿名四项 1–5 星评分（视野、声音、周边便利、交通便利，再次评分会改分），下方是按 `venue:<id>` 严格映射的 giscus 评论，跨语言与子坐席图共享同一讨论。
- **免注册上传** —— 标点（可进全屏放大精修）→ 选图 → 客户端压成 WebP（去 EXIF）→ HMAC ticket 两段式提交；未完成步骤有行内引导，全程 IP 限频 + Turnstile 防滥用。
- **多语 i18n** —— `/zh` `/ja` `/en` `/ko` 四前缀路由，裸根 `/` 按 `Accept-Language` 自动重定向（`zh`/`ja` 等价双轨，`en`/`ko` 为可达性翻译层）。
- **场馆众包** —— 站内「想看的场馆」暂存区可 +1 附议（公开票数 + 每日限流 + 同名去重），或通过 GitHub PR 直接提交场馆 JSON。
- **维护者后台** —— `/admin` 由 Cloudflare Access 边缘鉴权，支持软删除投稿。
- **SEO 与 AI 可发现性** —— 每页输出 canonical + 四语 hreflang（含 `x-default`）；场馆页注入 `MusicVenue`（评分样本充足时附 `aggregateRating`）/ `BreadcrumbList` / 座位照片 `ImageGallery` 结构化数据，首页注入 `WebSite` / `Organization`；站点根提供 `/sitemap.xml`（locale × 路径 + hreflang 备选）与 `/llms.txt`（面向 AI 的纯文本场馆索引），低价值页（暂存区 / 后台）标 `noindex,follow`。

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | **Astro 6.4** + React 19.2 Islands | 大部分静态化，交互组件用 React |
| 部署适配器 | **`@astrojs/cloudflare` v13.7** | Astro 6 已不支持 Cloudflare Pages，全面用 **Workers**（SSR + 静态资源同一个 Worker） |
| 运行时绑定 | **`import { env } from "cloudflare:workers"`** | Astro v6 移除了 `Astro.locals.runtime.env`；类型见 `src/env.d.ts` 的 `Cloudflare.Env` |
| 样式 | **Tailwind v4.3**（Vite 插件 `@tailwindcss/vite`） | 无独立 `tailwind.config`；设计 token 写在 `src/styles/global.css` |
| UI 组件 | **全部手写**（按 `DESIGN.md` token） | `components.json` 虽在，但 UI 并非 shadcn/ui 生成 |
| 图标 | `lucide-react` | |
| 搜索 | **Fuse.js**（客户端全量） | 场馆 ≤ 200，bundle 内全量搜索零延迟 |
| 数据库 | **Cloudflare D1 + Drizzle ORM** | photos / staging / photo corrections / venue ratings；schema 见 `src/server/db/schema.ts`；迁移用 `drizzle-kit generate` |
| 限频 | **Cloudflare KV**（`RATE_LIMIT`） | 上传、暂存区、座位号纠错、评分的每日计数与冷却，带 TTL 自动过期 |
| 图片存储 | **Cloudflare R2**（`BUCKET`） | **绑定直写**，不是 presigned URL |
| 防机器人 | **Cloudflare Turnstile** | 两步：前端 token → 后端 siteverify |
| 评论 | **giscus** + `@giscus/react` | GitHub Discussions 承载；评论抽屉首次打开才懒加载，主题跟随站点亮 / 暗模式 |
| 匿名评分 | **D1 聚合表** + React island | 四项 1–5 星评分；`venue_id + ip_hash` 去重，`venue_rating_agg` 读四维聚合 |
| 图片处理 | `browser-image-compression` | 长边 1920px / WebP / 去 EXIF / ~500KB |
| Lightbox | `yet-another-react-lightbox` v3 | |
| 瀑布流 | `react-photo-album`（masonry） | |
| 坐席图缩放 | **`react-zoom-pan-pinch` v4.0** | 用 `setTransform` / `resetTransform` 程序化缩放 |
| i18n | **Astro 内置 i18n 路由** | `/zh` `/ja` `/en` `/ko` 四前缀，裸根 302 |
| SEO / 结构化数据 | **手写 JSON-LD + hreflang + sitemap / llms.txt** | `src/lib/seo/`（纯函数 + 单测）：canonical / 四语 hreflang / `MusicVenue`·`Breadcrumb`·`ImageGallery` JSON-LD / `/sitemap.xml` / `/llms.txt` |
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

# 3.（可选）为新增、imageUrl 指向 .svg 的场馆生成占位坐席图；已收录场馆的坐席图已随仓库提供
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
| `npm test` | `node --experimental-strip-types --test`，运行纯逻辑单测 |
| `npm run typecheck` | `astro check`，类型检查 |
| `npm run format` / `format:check` | Prettier 格式化 / 校验（CI 用 `format:check`） |
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

# 5. 配置 giscus 评论（公开资源 id，不是密钥）
#    在 GitHub repo 开启 Discussions、安装 giscus App、创建 "Venue Comments" category，
#    然后把 PUBLIC_GISCUS_REPO / REPO_ID / CATEGORY / CATEGORY_ID 填进
#    .env.production，并同步 wrangler.jsonc vars

# 6. 部署
npm run deploy
```

> [!NOTE]
> **自动部署 (CD)**：配置完成后，push 到 `main` 会由 GitHub Actions 自动构建并部署到 Cloudflare（`.github/workflows/ci.yml`，检查全绿后才部署；也可在 Actions 页 “Run workflow” 手动触发）。上面的 `npm run deploy` 用于首次 / 本机手动部署。
>
> **一次性配置**：在 Cloudflare 控制台用 “Edit Cloudflare Workers” 模板创建 API Token（Account 选本账号、Zone 选 `genchi.top`；若 custom domain 报权限不足再补 Zone → DNS: Edit），然后到 GitHub repo → Settings → Secrets and variables → Actions 添加 secret `CLOUDFLARE_API_TOKEN`。
>
> CD **不**自动跑 D1 迁移；改了 schema 仍需手动 `npm run db:migrate:prod`。

> [!IMPORTANT]
> **维护者后台**（`/admin` + `/api/admin/*`）由 **Cloudflare Access (Zero Trust)** 在边缘保护：在控制台 Zero Trust → Access → Applications 新建 self-hosted 应用覆盖 `/*/admin` 与 `/api/admin/*`，加一条 Allow → 维护者邮箱的 policy。Access 鉴权后注入 `Cf-Access-Authenticated-User-Email`，Worker 信任该头（`src/server/admin-auth.ts`），匿名流量到不了 Worker。生产**无需**任何 admin 环境变量；**切勿**在生产设 `DEV_ADMIN_EMAIL`——那会绕过 SSO 网关。

> [!NOTE]
> 本仓库已带 74 个日本 / 海外场馆条目（`public/seatmaps/` 下 90 个坐席图资源）+ demo 标注。生产的真实标注由用户通过上传流程写入 D1。改了 DB schema 才需要重新跑 `npm run db:migrate:prod`；纯前端改动无需迁移。

## 工作原理

### 上传流程（绑定直写 + HMAC ticket）

不是 presigned URL 客户端直传，而是 **sign + commit 两段式**，确保 D1 写入不可伪造，且本地 miniflare R2 即可全程演练、无需 S3 凭证 / 桶 CORS：

1. **客户端**在坐席图上标点、选图，用 `browser-image-compression` 压成 ~500KB WebP（长边 ≤ 1920、去 EXIF），并过 Turnstile 拿 token。
2. **`POST /api/upload/sign`** —— Worker 校验 Turnstile + 30s 冷却 + 10/天上限（KV，键用**哈希后的 IP**），签发一张 **HMAC ticket**，绑定将写入的全部字段（venue / sub-map / 坐标 / 座位号 / `ip_hash` / `image_key` / 过期时间）。此时**不**消耗每日配额。
3. **`POST /api/upload/commit`**（multipart）—— 客户端把 ticket + WebP 字节发回。Worker 重新校验 HMAC + 过期，将字节经 `BUCKET` 绑定写入 R2，再**用 ticket 里的字段**（不信任请求体）插入 D1，最后才扣每日配额 + 启动 30s 冷却。
4. 网络错误 / 5xx 自动重试，复用同一 ticket（与已消费的 Turnstile token）；4xx（如 ticket 过期）不重试。

软删除：维护者在 `/admin` 删除图片时，D1 置 `deleted_at`（公共查询过滤 `deleted_at IS NULL`，标注点 / 卡片立即消失），R2 对象保留在回收站，可恢复；只有回收站里的「彻底删除」会同时物理删除 R2 对象和 D1 行。

### 环境变量 / 绑定

| 名称 | 类型 | 用途 | 本地 | 生产 |
|---|---|---|---|---|
| `DB` | D1 | photos + staging_venues + photo_correction_requests + venue_ratings / venue_rating_agg | miniflare 自动 | `wrangler.jsonc` 填真实 `database_id` |
| `BUCKET` | R2 | 上传图片存储（绑定直写） | miniflare 自动 | `wrangler.jsonc`（`bucket_name`） |
| `RATE_LIMIT` | KV | IP 限频计数 + 冷却（TTL），含上传 / 暂存 / 座位号纠错 / 评分 | miniflare 自动 | `wrangler.jsonc` 填真实 KV id |
| `SESSION` | KV | Astro CF 适配器 session API 要求的绑定（不实际写） | miniflare 自动 | `wrangler.jsonc` 填真实 KV id |
| `TURNSTILE_SECRET_KEY` | 密钥 | 后端 siteverify / HMAC ticket / IP-hash salt | `.dev.vars`（测试 secret） | `wrangler secret put` |
| `PUBLIC_TURNSTILE_SITE_KEY` | 公共 var | 前端 Turnstile widget | `.env.development` | `.env.production`（+ `wrangler.jsonc` vars 运行时副本） |
| `PUBLIC_R2_BASE_URL` | 公共 var | 拼接上传图片 URL；空 → 同源 `/r2/<key>` 兜底 | `.env.development`（空） | `.env.production`（r2.dev / 自定义域名） |
| `PUBLIC_SITE_URL` | 公共 var | 站点基址 | `http://localhost:4321` | 生产域名 |
| `PUBLIC_GISCUS_REPO` / `PUBLIC_GISCUS_REPO_ID` / `PUBLIC_GISCUS_CATEGORY` / `PUBLIC_GISCUS_CATEGORY_ID` | 公共 var | giscus 场馆评论配置；缺必填值时评论区显示未开放且不加载第三方资源 | `.env.development` | `.env.production`（+ `wrangler.jsonc` vars 运行时副本） |
| `DEV_ADMIN_EMAIL` | 仅本地 | mock 维护者身份（无 Access 边缘时） | `.dev.vars`（任意邮箱） | **绝不设置**（用 Cloudflare Access） |

> [!NOTE]
> `PUBLIC_*` 由 Vite 在**构建期**从 `.env*` 内联进客户端 bundle（islands 通过 `import.meta.env.PUBLIC_*` 读取）——**不**来自 `wrangler.jsonc` 的 `vars`（那只到 Worker 运行时）。两套机制、两份文件，Turnstile / R2 / giscus 这类公共值都要保持同步。R2 上传**不需要** S3 presigned 凭证（`R2_ACCESS_KEY_ID` 等），Worker 经 `BUCKET` 绑定直写。

### 场馆评论与匿名评分

场馆页标题区挂载 `VenueComments` island，默认只显示一个降权的小入口（平均分 / 评分数 / 评论）。首次打开抽屉时才动态加载 `@giscus/react`；关闭抽屉时隐藏而不是卸载，因此 giscus iframe 不会反复重载。giscus 使用 `mapping="specific"` + `term="venue:<id>"`，同一场馆在不同语言路径、不同子坐席图 tab 下共享同一条 GitHub Discussions 讨论；主题跟随站点的 `html.dark` 类，而不是系统主题。若 `PUBLIC_GISCUS_CATEGORY_ID` 等配置为空，评论区只显示“暂未开放”状态，不加载任何第三方脚本或 iframe。

匿名评分走 `POST /api/rating`，只接受静态场馆 `venue.id` 与完整四项 1–5 星评分：视野、声音、周边便利、交通便利。它不跑 Turnstile（单次评分不应弹挑战），但仍使用 `TURNSTILE_SECRET_KEY` 作为 IP-hash salt；D1 中 `venue_ratings` 通过 `venue_id + ip_hash` 唯一索引去重，同一人再次评分会改四项分数而不是新增一票。`venue_rating_agg` 保存四维 count / sum 聚合，写入与聚合更新在同一个 `db.batch` 中完成；场馆页 SSR 只读这一行聚合，失败时降级为空评分，不影响页面打开。KV 只限制“每天新增评分的不同场馆数”，改已有分数不消耗配额。

### 照片数量与分享深链

场馆页 SSR 会读取当前 sub-map 的初始照片，以及 `listVenuePhotoCounts` 返回的分区统计。标题下方的 `VenuePhotoCountLine` 会显示单图场馆总数，或多图场馆的“当前区域 / 全场馆”数量；切换 sub-map 重新拉取照片、上传成功时，都会通过 `seatview:photo-count-change` 事件同步这行数字。

Lightbox 的分享链接以照片 ULID 为主：`/{locale}/v/{venueId}?tab=<subMapId>&photo=<photoId>`。页面只在存在 `?photo=` 时做一次主键查询，确认照片未软删除、属于当前场馆，并用照片自己的 sub-map 覆盖旧的 `?tab=` 后自动打开 Lightbox；无法解析的链接降级为普通场馆页。Lightbox 浏览时用 `replaceState` 更新 `?photo=`，分享按钮复制当前语言的短文案 + canonical link。

Lightbox 底部还有一条「附近座位」横滑预览条（`NearbyStrip`，同簇邻座缩略图），点缩略图直接切到邻座照片；「在坐席图中定位」按钮则关闭 Lightbox，把当前照片设为选中并把对应标注点滚动 / 高亮回坐席图。

### SEO 与结构化数据 / AI 可发现性

`Layout.astro` 给每页输出 `<link rel="canonical">` 与四语 `hreflang`（`zh-Hans` / `ja` / `en` / `ko` + `x-default`，由 `src/lib/seo/hreflang.ts` 生成）；`description` 可按页覆盖，缺省回落到站点 tagline。暂存区、后台等低价值或受限页传 `noindex`，输出 `<meta name="robots" content="noindex,follow">` 并跳过 hreflang。

场馆页 SSR 注入三段 JSON-LD：`MusicVenue`（地址 / 别名，评分样本充足时附 `aggregateRating`）、`BreadcrumbList`（首页 → 都道府县 → 场馆）、以及该场馆座位照片的 `ImageGallery`（逐张 `ImageObject` 带 caption 与 CC 许可，给爬虫一个无需渲染的图片信号）；首页注入 `WebSite` + `Organization`。构建逻辑集中在 `src/lib/seo/jsonld-core.ts`（纯函数，带 `*.test.ts`）。

站点根另有两个 SSR 端点，均从静态 `venues` 数组生成、不碰 D1：`/sitemap.xml`（每个 locale × 路径一条 `<url>`，附全语言 `xhtml:link` 备选 + `x-default`，`<lastmod>` 用构建期时间戳 `__BUILD_TIME__`，redeploy 才变）与 `/llms.txt`（[llmstxt.org](https://llmstxt.org/) 风格的纯文本概览 + 全场馆 zh 规范链接，供 AI 抓取）。`public/robots.txt` 放行全部 UA 并指向 sitemap。

### 关键实现取舍

<details>
<summary>几处与早期 PRD / research 描述<b>有意不同</b>的实现（展开）</summary>

1. **UI 全手写**，不是 shadcn/ui 生成。
2. **上传是「绑定直写」**（客户端把压好的 WebP 发给 Worker，Worker 用 `BUCKET` 绑定写 R2），用 HMAC ticket 的 sign + commit 两段式防伪——**不是** presigned URL 客户端直传 R2。
3. **Astro v6** 读绑定用 `import { env } from "cloudflare:workers"`，不是 `Astro.locals.runtime.env`。
4. **Tailwind v4 Vite 插件**，无独立 config，token 在 `src/styles/global.css`。
5. **`react-zoom-pan-pinch` v4.0**，继续用 `setTransform` / `resetTransform` 保持聚合点居中计算可控。
6. **ULID 自实现**（`crypto.getRandomValues`），不用 `ulid` 包。
7. R2 绑定名是 **`BUCKET`**、限频 KV 是 **`RATE_LIMIT`**，另有 **`SESSION`** KV（适配器自动启用 session API 所需，SeatView 无账号系统、不实际写 session，但绑定需可解析）；admin 用 **Cloudflare Access**（`Cf-Access-Authenticated-User-Email` 头），本地用 `.dev.vars` 的 `DEV_ADMIN_EMAIL` mock。
8. **giscus 评论是可选公共配置**：缺 `PUBLIC_GISCUS_*` 时不加载第三方资源；配置齐全后，评论按 `venue:<id>` 映射到 GitHub Discussions。
9. **场馆评分是匿名 D1 聚合**：`venue_ratings` 存每个 `venue_id + ip_hash` 的当前四项分数，`venue_rating_agg` 存展示聚合；不是 GitHub reaction，也不是社交点赞。
10. **照片深链以 `?photo=<ulid>` 为权威**：`?tab=` 只用于可读性与兜底；服务器从照片记录反推 sub-map，因此子坐席图重命名不会破坏已分享链接。

</details>

## 项目结构

```
seatmap-real/
├── astro.config.mjs          # Astro 6.4 + CF Workers 适配器 + Tailwind v4.3 Vite 插件 + i18n
├── wrangler.jsonc            # CF 绑定：DB(D1) / BUCKET(R2) / RATE_LIMIT,SESSION(KV) / vars
├── drizzle.config.ts         # drizzle-kit：从 schema 生成迁移到 ./migrations
├── data/
│   ├── venues/<id>.json      # 静态场馆元数据，构建时打进 bundle
│   └── _venue-template.json  # 贡献者样板（在 venues/ 之外，不进 bundle / 种子）
├── migrations/               # D1 迁移：photos / staging_votes / photo_corrections / venue_ratings
├── seeds/0001_demo_photos.sql# 本地 demo 标注点（脚本生成，仅本地）
├── scripts/                  # 占位坐席图 / demo 种子 / 坐标迁移脚本
├── public/seatmaps/<id>/...  # 维护者上传的坐席图 WebP（非官方版权图）
└── src/
    ├── env.d.ts              # Cloudflare.Env 绑定类型
    ├── middleware.ts         # 根 302 / locale 解析 / admin 守卫
    ├── i18n/                 # locale 配置 + 文案
    ├── data/                 # 场馆树 + 47 都道府县
    ├── types/venue.ts        # Venue / SubMap / Photo / StagingVenue 单一真源
    ├── lib/                  # 跨层契约 + 客户端工具（upload / staging / venue-rating / share / photo counts / transport；SEO 助手见 lib/seo）
    ├── server/               # Worker 侧：db / photos / staging / ratings / rate-limit / turnstile / id / admin-auth / r2
    ├── pages/                # api/（upload·staging·rating·admin·photos）+ [lang]/（首页 / 场馆页 / 暂存区 / 后台 / 隐私 / 条款）+ sitemap.xml / llms.txt（站点根 SSR 端点）
    └── styles/global.css     # Tailwind v4.3 + 设计 token（OKLCH 中性色 + 朱赤 accent）
```

## 贡献

补充新场馆有两条通道：

1. **只报名字** —— 站内「想看的场馆」页（`/zh/staging`、`/ja/staging`），其他用户可 +1。门槛最低。
2. **自己加数据** —— GitHub Fork → 编辑 `data/venues/<id>.json` → PR。面向非编码者的图文教程、字段说明见 **[CONTRIBUTING.md](CONTRIBUTING.md)**，样板见 [`data/_venue-template.json`](data/_venue-template.json)。

> [!IMPORTANT]
> 站点代码以 **Apache 2.0** 开源（见 [LICENSE](LICENSE)）。用户上传的照片及其元数据以 **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)** 共享——上传前有强制勾选的同意框。**请勿提交有版权的官方坐席图**：`public/seatmaps/` 下均为维护者上传的坐席图（非官方版权图）。

## 致谢

- **技术社区** —— 感谢 [Linux Do](https://linux.do/) 社区在开发过程中的交流与帮助。
- **坐席图参考来源** —— 场馆坐席图的校对参考了 [LiveKiti](https://livekiti.com/) 与 [LiveWalker](https://www.livewalker.com/)。

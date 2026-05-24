# SeatView

[![Website](https://img.shields.io/badge/Website-seat.genchi.top-brightgreen)](https://seat.genchi.top) [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE) [![CI](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml/badge.svg)](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml)

> 内部代号 `seatmap-real` ／ 对外品牌名 **SeatView** · 真实视角图集 / リアル座席ビュー

聚合日本（含部分海外）演唱会场馆**真实座位视角图**的网站。用户在场馆官方坐席图上标注自己的座位、上传该位置的实拍照片；其他人点击坐席图上的标注点，就能在 Lightbox 里预览那个座位的真实视角。**无需注册**即可浏览与上传，靠 IP 限频 + Cloudflare Turnstile 防滥用。全栈跑在 Cloudflare 一家：Workers（SSR + 静态资源）+ D1 + KV + R2。

核心价值：粉丝在抢票 / 选座前，能预览各个座位的实际观演视角，做出更明智的购买决策。

---

## 技术栈（按真实依赖版本）

| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | **Astro 6.3** + React 19 Islands | 大部分静态化，交互组件用 React |
| 部署适配器 | **`@astrojs/cloudflare` v13.x** | Astro 6 已不支持 Cloudflare Pages，全面用 **Workers**（SSR + 静态资源同一个 Worker） |
| 运行时绑定读取 | **`import { env } from "cloudflare:workers"`** | Astro v6 移除了 `Astro.locals.runtime.env`；绑定通过 `cloudflare:workers` 的 `env` 读取，类型见 `src/env.d.ts` 的 `Cloudflare.Env` |
| 样式 | **Tailwind v4（Vite 插件 `@tailwindcss/vite`）** | 没有独立 `tailwind.config`；设计 token 写在 `src/styles/global.css` |
| UI 组件 | **全部手写**（按 `DESIGN.md` token） | 虽然 `components.json` 存在，但 UI 并非由 shadcn/ui 生成——是按 SeatView 的「克静纸面」设计系统手写的组件 |
| 图标 | `lucide-react` | |
| 搜索 | **Fuse.js**（客户端全量） | 场馆 ≤ 200，bundle 内全量搜索零延迟 |
| 数据库 | **Cloudflare D1 + Drizzle ORM** | schema `src/server/db/schema.ts`；迁移用 `drizzle-kit generate` + `wrangler d1 migrations apply` |
| 限频 | **Cloudflare KV**（`RATE_LIMIT` 绑定） | 每日计数 + 30s 冷却，带 TTL 自动过期 |
| 图片存储 | **Cloudflare R2**（`BUCKET` 绑定） | 见下方「上传流程」——**绑定直写**，不是 presigned URL |
| 防机器人 | **Cloudflare Turnstile**（两步：前端 token → 后端 siteverify） | |
| 客户端图片处理 | `browser-image-compression` | 长边 1920px / WebP / 去 EXIF / ~500KB（R5） |
| Lightbox | `yet-another-react-lightbox` v3 | |
| 瀑布流 | `react-photo-album`（masonry） | |
| 坐席图缩放/平移 | **`react-zoom-pan-pinch` v3.7** | 用 `setTransform` / `resetTransform` 做程序化缩放（v3.7 没有 v4 的 `zoomTo`） |
| i18n | **Astro 内置 i18n 路由** | `/zh/...` 与 `/ja/...` 双前缀；裸根 `/` 检测 `Accept-Language` 后 302（`src/middleware.ts`） |
| ULID | **自实现**（`src/server/id.ts`，基于 `crypto.getRandomValues`） | 没有使用 `ulid` npm 包——它在 import 时即 `detectPrng()`，在 workerd 上抛错。`photos.id` / `staging_venues.id` 用这个自实现的 26 字符、按时间可排序的 ULID |

> ⚠️ 几处实现与早期 PRD/research 描述**有意不同**，以本仓库为准：
> 1. **UI 全手写**，不是 shadcn/ui 生成。
> 2. **上传是「绑定直写」**（客户端把压好的 WebP 发给 Worker，Worker 用 `BUCKET` 绑定写 R2），用 **HMAC ticket** 的 sign + commit 两段式防伪——**不是** ADR-12 描述的「presigned URL 客户端直传 R2」。这样 D1 写入不可伪造，且本地 miniflare R2 即可全程演练，无需 S3 凭证 / 桶 CORS。
> 3. **Astro v6** 读绑定用 `import { env } from "cloudflare:workers"`，不是 `Astro.locals.runtime.env`。
> 4. **Tailwind v4 Vite 插件**，无独立 config，token 在 `src/styles/global.css`。
> 5. **`react-zoom-pan-pinch` v3.7**，用 `setTransform`/`resetTransform`。
> 6. **ULID 自实现**（`crypto.getRandomValues`），不用 `ulid` 包。
> 7. R2 绑定名是 **`BUCKET`**，限频 KV 是 **`RATE_LIMIT`**，另有 **`SESSION`** KV（Astro CF 适配器自动启用 session API 要求的绑定，SeatView 无账号系统、不实际写 session，但绑定需可解析）；admin 用 **Cloudflare Access**（`Cf-Access-Authenticated-User-Email` 头），本地用 `.dev.vars` 的 `DEV_ADMIN_EMAIL` mock。

---

## 项目结构（简述）

```
seatmap-real/
├── astro.config.mjs          # Astro 6 + CF Workers 适配器 + Tailwind v4 Vite 插件 + i18n
├── wrangler.jsonc            # CF 绑定：DB(D1) / BUCKET(R2) / RATE_LIMIT,SESSION(KV) / vars
├── drizzle.config.ts         # drizzle-kit：从 schema 生成迁移到 ./migrations
├── components.json           # 存在但 UI 实为手写（见上）
├── data/
│   ├── venues/<id>.json      # 静态场馆元数据（ADR-1），构建时打进 bundle
│   └── _venue-template.json  # 贡献者样板（在 venues/ 之外，不进 bundle / 不进种子）
├── migrations/0000_init.sql  # D1 初始 schema（photos + staging_venues）
├── seeds/0001_demo_photos.sql# 本地 demo 标注点（由脚本生成，仅本地）
├── scripts/
│   ├── gen-placeholder-seatmaps.mjs  # 为每个 sub-map 生成占位坐席图 SVG
│   └── gen-demo-seed.mjs             # 生成 seeds/0001_demo_photos.sql
├── public/seatmaps/<id>/<sub-map>.svg # 占位坐席图（非真实版权图）
├── src/
│   ├── env.d.ts              # Cloudflare.Env 绑定类型
│   ├── middleware.ts         # 根 302 / locale 解析 / admin 守卫
│   ├── i18n/                 # locale 配置 + 文案
│   ├── data/venues.ts        # import.meta.glob 加载 data/venues/*.json + 建场馆树
│   ├── data/prefectures.ts   # 47 都道府县 + 海外的 slug / 双语标签 + 区域分组
│   ├── types/venue.ts        # Venue / SubMap / Photo / StagingVenue 单一真源
│   ├── lib/                  # 跨层契约（upload / staging / admin / photos…）+ 客户端工具
│   ├── server/               # Worker 侧：db / photos / staging / rate-limit / turnstile
│   │                         #   / ip / id(ULID) / admin-auth / upload-ticket / r2/images
│   ├── pages/
│   │   ├── api/              # upload/{sign,commit} · staging · admin/{photos,staging} · photos
│   │   └── [lang]/...        # 首页 / 场馆页 / 暂存区 / 后台
│   └── styles/global.css     # Tailwind v4 + 设计 token（OKLCH 中性色 + 朱赤 accent）
```

---

## 本地开发

前置：Node ≥ 20。

```bash
# 1. 安装依赖
npm install

# 2. 准备本地密钥（Turnstile 测试 key 等）
cp .dev.vars.example .dev.vars
#   .dev.vars 默认用 Cloudflare 文档里的「永远通过」Turnstile 测试 secret，
#   配合 wrangler.jsonc 里的测试 site key，可离线演练上传流程。
#   想测试 /admin，把 DEV_ADMIN_EMAIL 设成任意邮箱（mock 维护者身份）；
#   想测未授权路径，留空它。

# 3. 生成本地占位坐席图（首次或加了场馆后）
npm run gen:seatmaps

# 4. 初始化本地 D1（应用迁移）
npm run db:migrate:local

# 5. 生成并灌入 demo 标注点（让坐席图 / 瀑布流 / Lightbox 有内容）
npm run gen:seed         # 生成 seeds/0001_demo_photos.sql
npm run db:seed:local    # 灌入本地 D1

# 6a. 纯页面开发（最快的 HMR，但 D1/KV/R2 绑定与 API 不可用）
npm run dev              # astro dev → http://localhost:4321

# 6b. 全功能本地运行（含 D1 / KV / R2 绑定 + API 端点，走 miniflare）
npm run preview          # = astro build && wrangler dev -c dist/server/wrangler.json
                         #   上传 / 暂存 / 后台 API 全部可用
```

> 选哪个？写 UI、调样式用 `npm run dev`（最快）。要联调上传 / 暂存 / 后台等需要 Cloudflare 绑定的功能时，用 `npm run preview`（先 `astro build`，再 `wrangler dev` **指向构建产物 `dist/server/wrangler.json`**——那份才带 `ASSETS` 绑定与正确的 SSR 入口，本地通过 miniflare 提供 D1/KV/R2）。
>
> ⚠️ **不要**直接对根 `wrangler.jsonc` 跑 `wrangler dev`（即不带 `-c`）：根配置只声明绑定、**没有** `main`/`assets`，会启动适配器源入口而非构建产物，导致所有页面 SSR 返回字面量 `[object Object]`。`npm run preview` / `npm run deploy` 已替你指向正确的 `dist/server/wrangler.json`。（这是配置问题，与 Windows 无关。）

可用脚本（`package.json`）：

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

---

## 部署到 Cloudflare

一次性创建资源，把返回的 id 填进 `wrangler.jsonc`，再迁移 + 部署。

```bash
# 1. 创建 D1 / KV / R2 资源
wrangler d1 create seatmap-real
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create SESSION       # Astro CF 适配器要求一个 SESSION KV 绑定
wrangler r2 bucket create seatmap-images

# 2. 把上面命令返回的真实 id 填进 wrangler.jsonc：
#    - d1_databases[0].database_id
#    - kv_namespaces[].id（RATE_LIMIT 与 SESSION 各一个）
#    （r2_buckets 用 bucket_name 即可，无需 id）

# 3. 应用迁移到远程 D1
npm run db:migrate:prod        # wrangler d1 migrations apply seatmap-real --remote

# 4. 配置 Turnstile 生产 key
#    - 在 Cloudflare 控制台创建 Turnstile widget，绑定生产域名
#    - 把 site key 填进 .env.production 的 PUBLIC_TURNSTILE_SITE_KEY（构建期内联进
#      客户端 bundle 的就是这里；并同步 wrangler.jsonc vars 的运行时副本）
#    - 把 secret key 作为密钥下发（不要写进仓库）：
wrangler secret put TURNSTILE_SECRET_KEY

# 5. 配置 R2 公共读基址（上传图片的可访问 URL）
#    给 BUCKET 开 r2.dev 公共访问或绑定自定义域名，把基址填进
#    .env.production 的 PUBLIC_R2_BASE_URL（image_key 会拼在它后面，见 src/lib/photos.ts；
#    同步 wrangler.jsonc vars 运行时副本）

# 6. 用 Cloudflare Access (Zero Trust) 保护 admin（ADR-11，R7.1）
#    在控制台 Zero Trust → Access → Applications：
#    a. 新建 self-hosted application，覆盖路径 /*/admin 与 /api/admin/*
#       （域名需走橙色云 Cloudflare proxy，Access 才生效）
#    b. 新建 policy：Allow → 维护者邮箱（GitHub / Google 等 IdP）
#    Access 在边缘鉴权后注入 Cf-Access-Authenticated-User-Email，Worker 信任该头
#    （src/server/admin-auth.ts）；匿名流量到不了 Worker。生产无需任何 admin 环境变量。
#    ⚠️ 不要在生产设 DEV_ADMIN_EMAIL——那会绕过 SSO 网关。

# 7. 部署
npm run deploy                 # astro build && wrangler deploy -c dist/server/wrangler.json
```

> `deploy` / `preview` 都用构建产物 `dist/server/wrangler.json`（带 `ASSETS` 绑定 + `entry.mjs` 入口）。根 `wrangler.jsonc` 只负责声明绑定，本身**没有** `main`，仅供 `wrangler d1 migrations apply` / `wrangler kv namespace create` / `wrangler secret put` 等绑定管理命令解析使用。

至少灌入 5 个真实场馆（本仓库已带 7 个高频场馆，取自 `research/top-15-venues.md` 的 TOP）+ 演示标注。生产标注由用户通过上传流程写入 D1。

---

## 环境变量 / 绑定清单

| 名称 | 类型 | 用途 | 本地（`.dev.vars` / `wrangler.jsonc`） | 生产 |
|---|---|---|---|---|
| `DB` | D1 绑定 | photos + staging_venues | `wrangler.jsonc` + 本地 miniflare 自动 | `wrangler.jsonc` 填真实 `database_id` |
| `BUCKET` | R2 绑定 | 上传图片存储（绑定直写） | `wrangler.jsonc` + 本地 miniflare 自动 | `wrangler.jsonc`（`bucket_name`） |
| `RATE_LIMIT` | KV 绑定 | IP 限频计数 + 30s 冷却（带 TTL） | `wrangler.jsonc` + 本地 miniflare 自动 | `wrangler.jsonc` 填真实 KV id |
| `SESSION` | KV 绑定 | Astro CF 适配器 session API 要求的绑定（SeatView 不实际写 session） | `wrangler.jsonc` + 本地自动 | `wrangler.jsonc` 填真实 KV id |
| `TURNSTILE_SECRET_KEY` | 密钥 | 后端 siteverify（上传 / 暂存） | `.dev.vars`（测试 secret） | `wrangler secret put` |
| `PUBLIC_TURNSTILE_SITE_KEY` | 公共 var（构建期内联） | 前端 Turnstile widget | `.env.development`（测试 site key） | `.env.production` 真实 site key（+ `wrangler.jsonc` vars 运行时副本） |
| `PUBLIC_R2_BASE_URL` | 公共 var（构建期内联） | 拼接上传图片可访问 URL；空 → 同源 `/r2/<key>` 兜底（本地无 R2 公共读时） | `.env.development`（空） | `.env.production`（r2.dev / 自定义域名基址） |
| `PUBLIC_SITE_URL` | 公共 var（构建期内联） | 站点基址 | `.env.development`（`http://localhost:4321`） | `.env.production`（生产域名） |
| `DEV_ADMIN_EMAIL` | 仅本地 | mock 维护者身份（无 Access 边缘时） | `.dev.vars`（任意邮箱） | **绝不设置**（用 Cloudflare Access） |

> R2 上传**不需要** S3 presigned URL 凭证（`R2_ACCESS_KEY_ID` 等）。Worker 通过 `BUCKET` 绑定直写 R2，见下「上传流程」。`.dev.vars.example` 里那几行只是为将来可能重新引入 presigned 路径留的占位，默认留空。

---

## 上传流程（绑定直写 + HMAC ticket，不是 presigned）

1. 客户端在坐席图上标点、选图，用 `browser-image-compression` 压成 ~500KB 的 WebP（长边 ≤1920，去 EXIF；R5），并过 Turnstile 拿到 token。
2. `POST /api/upload/sign`：Worker 校验 Turnstile（一次性 siteverify）+ 30s 冷却 + 10/天上限（KV，键用**哈希后的 IP**），通过后签发一张 **HMAC ticket**——里面绑定了将要写入的全部字段（venue / sub-map / 坐标 / 座位号 / 选填字段 / `ip_hash` / `image_key` / 过期时间）。此时**不**消耗每日配额（失败 / 放弃不计数）。
3. `POST /api/upload/commit`（multipart）：客户端把 ticket + WebP 字节发回。Worker 重新校验 HMAC + 过期，把字节通过 `BUCKET` 绑定写进 R2，再**用 ticket 里的字段**（不信任请求体）插入 D1，最后才扣每日配额 + 启动 30s 冷却。
4. ADR-12 的「失败自动重试」在客户端 commit 调用上实现：网络错误 / 5xx 重试，复用同一 ticket（与已消费的 Turnstile token）；4xx（如 ticket 过期）不重试。

软删除（ADR-6）：维护者在 `/admin` 软删除时，D1 置 `deleted_at`（公共查询过滤 `deleted_at IS NULL`，标注点 / 卡片立即消失）并物理删除 R2 对象。

---

## 上传内容版权（CC BY-NC 4.0）

- **站点代码**：Apache 2.0（见 [`LICENSE`](LICENSE)）。
- **用户上传的照片与其元数据**：**[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)**。上传表单底部有**强制勾选**的同意框（R11 / ADR-5）：

  > ☐ 我确认拥有此照片的版权，并同意以 CC BY-NC 4.0 协议分享给本站及其他用户参考。我已遮蔽他人面部 / 不当个人信息。

  未勾选时上传按钮 disabled；勾选并提交即视为同意（D1 不单独存同意状态，R11.4）。

---

## 贡献新场馆

两条并行通道（R13）：

1. **只报名字**：站内「想看的场馆」页（`/zh/staging`、`/ja/staging`）。
2. **自己加数据**：通过 GitHub Fork → Edit → PR 提交场馆 JSON。详见 [`CONTRIBUTING.md`](CONTRIBUTING.md)（面向非编码者的图文教程 + 字段说明），样板见 [`data/_venue-template.json`](data/_venue-template.json)，PR 检查清单见 [`.github/pull_request_template.md`](.github/pull_request_template.md)。

---

## 许可

- 站点代码：Apache 2.0 — [`LICENSE`](LICENSE)
- 用户上传内容：CC BY-NC 4.0 — https://creativecommons.org/licenses/by-nc/4.0/

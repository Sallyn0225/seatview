# SeatMap-Real MVP

> 内部代号：`seatmap-real`  ／  对外品牌名：**SeatView**

## Goal

构建一个聚合日本（含部分海外）演唱会场馆"真实座位视角图"的网站 **SeatView**。用户可在场馆官方坐席图上标注自己的座位位置并上传该位置实拍照片，其他用户点击坐席图上的标注点即可在 Lightbox 中预览该座位的真实视角。无需注册即可浏览与上传，通过 IP 限频 + Cloudflare Turnstile 防滥用。部署在 Cloudflare 全家桶（Workers + D1 + KV + R2）。

主要价值：粉丝在抢票/选座前能够预览各个座位的实际观演视角，做出更明智的购买决策。

## Background / Source

源自 `my-idea.md`，经过 3 轮手动 brainstorm 讨论收敛而成。

## Requirements

### R1. 浏览：左侧场馆树

- R1.1 左侧按**日本一级行政区划**（北海道 + 46 都府县）+ "海外"分组聚合场馆
- R1.2 行政区划可折叠/展开（默认折叠或仅展开有访问历史的）
- R1.3 行政区划划分参考 [eventernote.com/places](https://www.eventernote.com/places)

### R2. 浏览：场馆搜索

- R2.1 顶部搜索框，输入时实时显示匹配的场馆候选
- R2.2 使用 **Fuse.js** 客户端全量搜索（场馆数 ≤ 200，性能足够）
- R2.3 多字段匹配：`name_zh`（中文名）、`name_jp`（日文名）、`name_romaji`（罗马字）、`prefecture`、`city`、`aliases[]`
- R2.4 配置：`ignoreLocation: true`（词序无关）、`threshold: ~0.4`、`useExtendedSearch: true`
- R2.5 支持多关键词空格分隔（如 "K Arena 横滨" / "横滨 K Arena" 都能命中）

### R3. 浏览：场馆详情页

- R3.1 路径 `/<lang>/v/[venue-id]`
- R3.2 进入场馆默认展示**唯一坐席图或第一个 sub-map**（多图场馆自动进入第一个 tag 页）
- R3.3 多图场馆顶部用**扁平 tags** 切换不同 sub-map（如 K Arena 的 L1/L3/L5/L7 各层独立 tag）
- R3.4 坐席图上覆盖**所有用户标注点**；标注点可点击
- R3.5 相邻标注点自动**聚合**为一个数字气泡，聚合阈值**随用户缩放级别动态变化**
- R3.6 点击聚合气泡 → 坐席图**自动平移 + 缩放放大**到该区域 → 聚合点散开为独立标注 → 用户再点具体的标注点
- R3.7 点击独立标注点 → 弹出 **Lightbox** 显示该座位的实拍照片 + 用户填写的座位号 + 选填字段（演出日期/活动名/描述）
- R3.8 坐席图支持**双指缩放/平移**（移动端），鼠标滚轮缩放（桌面端）
- R3.9 坐席图下方为**瀑布流**展示该场馆/sub-map 的所有上传照片 + 文字描述，**默认按上传时间倒序**（最新在前）

### R4. 上传功能

- R4.1 上传按钮显示在当前 sub-map 视图的坐席图与瀑布流之间
- R4.2 上传归属逻辑：上传所属的 sub-map = 用户当前所在的 sub-map（无显式选择，对用户透明）
- R4.3 上传流程：
  1. 用户点击「上传我的视角」
  2. 弹出**无标注**的纯净坐席图
  3. 用户在坐席图上点击标注自己的座位（支持调整位置 / 撤销）
  4. 标注完成后，提示选择本地图片
  5. 客户端处理图片（见 R5）
  6. 填写表单：**座位号文本（必填）**、演出日期（选填，shadcn Date Picker）、活动名（选填）、简短描述（选填）
  7. **强制勾选版权同意框**（见 R11）后才能提交
  8. 通过 Turnstile 校验 → 客户端直传 R2（presigned URL）→ Worker 写 D1
- R4.4 用户**不可编辑/撤回**已上传内容（MVP 简化）

### R5. 图片处理（客户端）

- R5.1 全部在浏览器端处理，不依赖 Worker CPU
- R5.2 长边限制 **1920px**
- R5.3 转换格式为 **WebP**
- R5.4 去除 **EXIF** 信息（隐私）
- R5.5 处理后体积控制在 ~500KB 以内

### R6. 暂存区（用户提交希望添加的场馆）

- R6.1 单独菜单/页面入口，路径 `/<lang>/staging`
- R6.2 用户提交表单**只有场馆名**（自由文本）
- R6.3 提交需通过 Turnstile，IP 限频 5 次/天
- R6.4 暂存区按提交时间倒序展示所有用户提交
- R6.5 **不做 +1 功能**（MVP 简化）
- R6.6 维护者通过 **GitHub PR**（编辑场馆 JSON）将其中合适的场馆转为正式场馆

### R7. 维护者后台（最简）

- R7.1 隐藏路径 `/<lang>/admin`，**环境变量密码**校验（无注册账号）
- R7.2 功能：
  - 浏览所有上传图片列表
  - 删除不当内容（清 D1 记录 + R2 对象）
  - 浏览暂存区，标记/删除已处理的提交
- R7.3 暂存区"转正式"通过 PR 完成，不在后台界面操作

### R8. 防滥用

- R8.1 上传图片：每 IP **10 张/天**，单次上传 30 秒冷却
- R8.2 暂存区提交：每 IP **5 次/天**
- R8.3 上传与暂存区提交均加 **Cloudflare Turnstile**
- R8.4 IP 限频计数写入 **KV**（带 TTL，自动过期）

### R9. 多语言

- R9.1 支持**简体中文**与**日本语**双语
- R9.2 自动检测浏览器 `Accept-Language`，首次访问按此跳转
- R9.3 URL 路径前缀区分：`/zh/...` 与 `/ja/...`
- R9.4 UI 文案 + 场馆名（`name_zh` / `name_jp`）随语言切换
- R9.5 用户上传的座位号、活动名、描述**保持用户原文**，不做翻译

### R10. 首屏与导航

- R10.1 首次访问：默认显示**项目说明页**，包含：
  - 一句话定位（站点是干啥的）
  - 使用流程示意（找场馆 → 看视角 → 上传）
  - 1-2 个示例场馆的直达链接（如东京花园剧场、K Arena 横滨）
  - 上传规则简版（本人拍摄 / 遮蔽他人 / 限频）
  - 关于 / GitHub 仓库链接 / 联系方式
  - 隐私政策 / 服务条款链接
- R10.2 后续访问：通过 **localStorage** 记录上次浏览的场馆，下次访问直接进入该场馆
- R10.3 左侧场馆树在桌面端常驻显示，移动端通过侧边抽屉打开

### R11. 上传内容版权与协议

- R11.1 上传表单底部加入**强制勾选**的同意框：
  > ☐ 我确认拥有此照片的版权，并同意以 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 协议分享给本站及其他用户参考。我已遮蔽他人面部 / 不当个人信息。
- R11.2 未勾选时**上传按钮 disabled**
- R11.3 footer 与说明页提供协议详细说明链接
- R11.4 D1 `photos` 表无需存储用户协议同意状态（已勾选才允许提交即可）

### R12. 主题切换

- R12.1 默认**跟随系统**（`prefers-color-scheme`）
- R12.2 右上角提供**亮色/暗色/系统**三态切换按钮
- R12.3 用户选择写入 localStorage（`theme: 'light' | 'dark' | 'system'`）
- R12.4 shadcn/ui 自带的 CSS 变量主题切换 + Tailwind `dark:` 类名

### R13. 贡献新场馆的双通道

- R13.1 **暂存区**（R6）：让普通用户提交"想看的场馆"，纯收集需求
- R13.2 **GitHub PR**：footer 与说明页加入「想贡献新场馆？」入口，引导用户通过 **GitHub 网页端 Fork → Edit → PR** 添加场馆数据
- R13.3 仓库提供：
  - `data/venues/<venue-id>.json` 模板文件 + 示例
  - `CONTRIBUTING.md` 教程（含截图，面向非编码者）
  - PR template 检查清单（坐席图无版权风险 / 字段完整 / id 唯一）
- R13.4 R13.2 引导路径与暂存区互不依赖，两条通道并行存在

## Data Model

### 场馆元数据（Git 仓库内静态 JSON / TS）

```ts
type Venue = {
  id: string;                    // url-safe slug, e.g. "k-arena-yokohama"
  name_zh: string;
  name_jp: string;
  name_romaji: string;
  prefecture: string;            // "kanagawa" / "overseas" / ...
  city: string;
  aliases: string[];
  subMaps: SubMap[];             // length >= 1; 单图场馆也有一个默认 sub-map
};

type SubMap = {
  id: string;                    // url-safe slug, e.g. "L3-center"
  label_zh: string;              // tag 文本（中文）
  label_jp: string;              // tag 文本（日文）
  imageUrl: string;              // 坐席图 URL（R2 公共桶 / static 资源）
  width: number;                 // 原始图宽（像素），用于坐标百分比换算
  height: number;
};
```

### 用户上传内容（D1）

```sql
-- 标注点 + 图片
CREATE TABLE photos (
  id TEXT PRIMARY KEY,                  -- ulid
  venue_id TEXT NOT NULL,
  sub_map_id TEXT NOT NULL,
  x_percent REAL NOT NULL,              -- 0.0 ~ 1.0
  y_percent REAL NOT NULL,
  image_key TEXT NOT NULL,              -- R2 object key
  seat_label TEXT NOT NULL,             -- 必填
  performance_date TEXT,                -- ISO 日期，选填
  event_name TEXT,                      -- 选填
  description TEXT,                     -- 选填
  ip_hash TEXT NOT NULL,                -- IP 哈希（用于审核与限频追踪，不存原 IP）
  created_at INTEGER NOT NULL,
  deleted_at INTEGER                    -- 软删除（维护者操作）
);
CREATE INDEX idx_photos_venue ON photos(venue_id, sub_map_id, deleted_at);

-- 暂存区场馆提交
CREATE TABLE staging_venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  processed_at INTEGER                  -- 维护者标记已处理
);
```

### 限频（KV）

```
key: ratelimit:upload:<ip_hash>:<YYYY-MM-DD>  → count
key: ratelimit:staging:<ip_hash>:<YYYY-MM-DD> → count
key: ratelimit:upload:cooldown:<ip_hash>      → ts (TTL 30s)
TTL: 24h(date counts) / 30s(cooldown)
```

## Technical Approach

### 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 前端框架 | **Astro** + React Islands | 大部分静态化、交互组件用 React |
| UI 组件 | **shadcn/ui** | Date Picker / Dialog / Sheet / Tabs |
| 图标 | **lucide** | |
| 搜索 | **Fuse.js** | 客户端全量 |
| i18n | Astro 内置 i18n 路由 + `astro-i18n` 或自封装 | 双语 |
| 部署 | **Cloudflare Workers**（含静态资源） | ⚠️ Astro 6+ 已不再支持 Cloudflare Pages，全面迁到 Workers |
| 服务端 | Astro `output: 'server'` SSR + API routes（同一个 Worker） | 不需要独立 Wrangler 项目 |
| 数据库 | **Cloudflare D1** + **Drizzle ORM** | 类型安全；migration 用 `wrangler d1 migrations` + `drizzle-kit` |
| 限频/缓存 | **Cloudflare KV**（滑动窗口算法 + 多层 IP/全局限流） | TTL 友好 |
| 图片存储 | **Cloudflare R2**（**客户端直传**，Worker 签发 presigned URL） | 省 Worker CPU 时间 |
| 防机器人 | **Cloudflare Turnstile**（两步验证：前端 token → 后端 JWT） | 防 token 过期，免费、UX 好 |
| i18n | **Astro 内置 i18n routing v4.6+**（非第三方包） | 静态化友好 |
| 客户端图片处理 | **`browser-image-compression`**（~40KB，Web Worker） | |
| Lightbox | **`yet-another-react-lightbox` v3+**（~28KB） | SSR 友好 |
| 瀑布流 | **`react-photo-album`**（~18KB，CSS flexbox 零依赖） | |
| 坐席图缩放/平移 | **`react-zoom-pan-pinch` v4+**（~13KB） | 提供 `zoomTo(x,y,scale)` 程序化 API |

### 路由设计

```
/[lang]/                            首页（说明页 / 上次访问场馆）
/[lang]/v/[venue-id]                场馆页（多图场馆默认进第一个 sub-map）
/[lang]/v/[venue-id]?tab=<sub-map>  切换 sub-map（query 而非 path，避免重命名失效）
/[lang]/staging                     暂存区
/[lang]/admin                       隐藏后台
/api/upload                         Worker 端点
/api/staging                        Worker 端点
/api/admin/*                        Worker 端点
```

[lang] ∈ { zh, ja }；根路径 `/` 检测 Accept-Language 后 302 跳转。

## Decision (ADR-lite)

### ADR-1: 场馆元数据存 Git 仓库而非 D1

- **Context**: 场馆名 / 坐席图 URL / sub-map 这些是开发者维护的静态数据
- **Decision**: 存 Git 仓库的 JSON / TS 文件，构建时打包进客户端
- **Consequences**:
  - ✅ 维护者通过 PR 即可加场馆，无需做管理界面
  - ✅ 客户端搜索零延迟（全量已在 bundle 中）
  - ✅ 简化 D1 schema
  - ⚠️ 添加场馆需要重新部署（可接受，频率低）

### ADR-2: 用户不可编辑/撤回上传

- **Context**: 不要求注册，无法稳定识别用户身份
- **Decision**: 上传后只能由维护者后台删除
- **Consequences**:
  - ✅ 实现最简
  - ⚠️ 用户传错只能联系维护者删除（PR / Issue 渠道）

### ADR-3: i18n 用路径前缀

- **Context**: 双语 + SEO + 场馆名数据中日双语
- **Decision**: `/zh/...` 与 `/ja/...`，根路径 302
- **Consequences**:
  - ✅ SEO 友好（搜索引擎收录两套语言）
  - ✅ URL 可分享时语言信息明确
  - ⚠️ 切换语言时 URL 完全变化（接受）

### ADR-4: 聚合点交互方案

- **Context**: 多个标注点过近时如何展示与点击
- **Decision**: 点击聚合气泡 → 自动放大坐席图到该区域 → 聚合自动散开 → 用户点具体点
- **Consequences**:
  - ✅ 用户体验直观（不出现弹窗中的弹窗）
  - ✅ 让用户对自己点击的座位"空间感"更强
  - ⚠️ 需要细致设计缩放曲线 + 散开动画

### ADR-5: 上传内容采用 CC BY-NC 4.0 协议

- **Context**: 无注册系统，但仍需明确用户上传图片的版权与使用范围
- **Decision**: 用户上传时强制勾选 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 协议
- **Consequences**:
  - ✅ 允许其他用户参考使用，符合站点定位
  - ✅ 禁止商业用途，保护用户权益
  - ✅ 要求署名，给上传者隐性激励
  - ⚠️ 不强制注册，无法精确归属给特定用户（仅站点级 attribution）

### ADR-6: 软删除策略

- **Context**: 维护者删除不当内容时，标注点与瀑布流的处理
- **Decision**: D1 `photos` 表用 `deleted_at` 字段做软删除；前端查询 `WHERE deleted_at IS NULL`；R2 对象一并删除（节省存储）
- **Consequences**:
  - ✅ 可追溯历史（维护者后台可恢复）
  - ✅ 标注点直接从 UI 消失（无"已删除占位"）
  - ⚠️ R2 物理删除不可逆，需谨慎

### ADR-7: 品牌名 SeatView

- **Context**: 项目内部代号 `seatmap-real` 偏技术，需对外品牌名
- **Decision**: 对外品牌名 **SeatView**；仓库 / package 名保持 `seatmap-real`
- **Consequences**:
  - ✅ 品牌名简洁易记、易传播
  - ✅ 副标题可灵活调整（暂定中文"真实视角图集"、日文"リアル座席ビュー"、英文"Real concert seat views"）
  - ⚠️ 域名待选（如 seatview.app / seatview.jp / etc.）

### ADR-8: 主题策略

- **Context**: 平衡用户偏好与默认体验
- **Decision**: 默认跟随系统 `prefers-color-scheme`；右上角三态切换（亮/暗/系统）；选择写入 localStorage
- **Consequences**:
  - ✅ 现代主流 UX 范式
  - ✅ shadcn/ui 原生支持，实现成本低

### ADR-9: 贡献新场馆双通道（暂存区 + GitHub PR）

- **Context**: 让普通用户也能贡献场馆数据，但场馆元数据由 Git 维护（ADR-1）
- **Decision**:
  - 普通用户 → 暂存区（仅提交名字）
  - 愿意贡献数据的用户 → footer/说明页引导 GitHub Web Fork→Edit→PR；提供 `CONTRIBUTING.md` 教程（含截图）
- **Consequences**:
  - ✅ 两条通道互补，降低贡献门槛
  - ⚠️ 教程文档需投入维护精力

## Acceptance Criteria

- [ ] 用户可在左侧场馆树点击任意场馆 → 进入该场馆的（默认）sub-map 页
- [ ] 用户在搜索框输入"K Arena"/"横浜 K"/"Kアリーナ"都能命中 K Arena 横滨
- [ ] 场馆页坐席图上正确显示所有该 sub-map 的标注点
- [ ] 相邻标注点正确聚合，缩放时聚合阈值变化
- [ ] 点击聚合气泡触发"放大 + 散开"动画，再点单点弹 Lightbox
- [ ] 瀑布流默认按上传时间倒序，移动端 1 列、平板 2 列、桌面 3-4 列
- [ ] 用户可标注坐席图、上传图片、填写表单 → 完成上传后立即可见
- [ ] 上传图片经客户端压缩到 WebP / 长边 ≤1920 / 去 EXIF
- [ ] 版权同意框未勾选时上传按钮 disabled
- [ ] IP 限频生效：超过 10 张/天 拒绝上传，超过 5 次/天 拒绝暂存提交
- [ ] 暂存区可正常提交并展示
- [ ] 维护者通过 `/admin` + 密码登录可软删除上传内容（前端标注点立即消失）
- [ ] 双语切换正常，浏览器 Accept-Language 自动检测，URL 前缀生效
- [ ] 主题三态切换正常（亮/暗/跟随系统），写入 localStorage
- [ ] 首次访问看到说明页，第二次直接进上次的场馆
- [ ] footer 提供「贡献新场馆」入口跳 GitHub Fork→Edit→PR 流程
- [ ] 移动端双指缩放/平移坐席图正常

## Definition of Done

- TypeScript 类型完整，无 `any`
- Lighthouse 性能评分 ≥ 80（桌面端首页 + 场馆页）
- 部署到 Cloudflare Workers 验证通过（含 D1 / KV / R2 / Turnstile 绑定）
- 至少 5 个真实场馆数据（取 `top-15-venues.md` 中容量 / 频次 TOP 5）+ 演示标注数据进入 D1
- README 包含本地开发 + 部署 + 环境变量步骤
- `CONTRIBUTING.md` 包含"如何添加新场馆"的图文教程（PR template + 字段说明）
- 仓库根目录有 LICENSE（站点代码）+ 上传内容协议说明（CC BY-NC 4.0）

## Out of Scope（MVP 明确不做）

- 用户注册 / 账号系统
- 评论 / 点赞 / 评分
- 用户个人主页 / "我的上传"管理
- 暂存区 +1 投票
- 暂存区维护者后台审核（直接通过 PR 处理）
- 场馆数据管理后台界面
- 推送 / 订阅通知
- 图片 OCR / AI 视角识别
- 多语言场馆名自动翻译（仅手动维护）
- 离线模式 / PWA
- 服务端图片处理 fallback

## Open Questions（剩余）

- [x] ~~Q1: 首批 15 场馆调研~~ → 见 `research/top-15-venues.md`，TOP 15 已确定
- [x] ~~Q2-Q5: 前端库选型~~ → 见 `research/frontend-libraries.md`
- [ ] Q6: 标注点聚合算法细节（聚合距离按屏幕像素，阈值与 zoom 反相关；初版 36px / scale，需实现后调参）
- [x] ~~Q7-Q8: Astro + shadcn / i18n~~ → 见 `research/cloudflare-astro-stack.md`
- [ ] Q9: Lighthouse 性能优化策略（坐席图大图懒加载、瀑布流虚拟化）→ 在实施阶段验证
- [x] ~~Q10: 维护者 PR 流程~~ → ADR-9 已决策（双通道）
- [x] ~~U-Q1~U-Q7~~ → ADR-5 ~ ADR-9 已固化所有用户决策

## Research References

- [`research/top-15-venues.md`](research/top-15-venues.md) — 首批支持的 15 个高频场馆（含日中英名、容量、都道府县、IP 出现频次）
- [`research/frontend-libraries.md`](research/frontend-libraries.md) — 4 个核心前端库选型与 Astro Island 集成策略
- [`research/cloudflare-astro-stack.md`](research/cloudflare-astro-stack.md) — Astro 6 + CF Workers + D1 + R2 + KV + Turnstile + i18n + shadcn 完整集成方案（含 wrangler 配置、Drizzle schema、限流中间件、上传流程示例代码）

## Technical Notes

- 参考行政区划：[eventernote.com/places](https://www.eventernote.com/places)
- 来源构想：`my-idea.md`
- Cloudflare 限制（已知）：D1 5GB / 5M reads/day（免费版）；Workers 100MB 单请求；R2 无 egress 费

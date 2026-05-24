# 修复：首页误跳转 / 人机验证不弹出 / 打点位置偏移

三个线上（seat.genchi.top）可复现的缺陷修复。根因均已通过读码 + 构建产物核验 + 浏览器实机复现确认。

## 背景与根因

### 1. 首页 `/zh` 自动跳转到场馆页（不应跳）
- `src/pages/[lang]/index.astro:60` 挂载 `<HomeRedirect client:load>`。
- `src/islands/HomeRedirect.tsx` 在 hydration 后读 `localStorage.seatview:last-venue`，命中即 `window.location.replace(/<lang>/v/<id>)`。
- `SiteHeader.astro:39`（logo）、`SiteFooter.astro` 的「关于/隐私政策/服务条款」均指向 `/<lang>/`，所以回首页就被再次弹走 → 老用户永远看不到说明页。
- **这是 spec R10.2 / shape-home-explainer.md §8 明确设计的行为**（§8 甚至承认 logo 会被弹回，并把「看说明页」寄托于一个从未实现的 `/<lang>/about` 页）。
- **决策（产品负责人确认）**：彻底移除自动跳转，`/zh` 永远展示说明页。属于对未完成设计的务实偏离。

### 2. 人机验证（Turnstile）不弹出
- `TurnstileWidget.tsx:39` 用 `import.meta.env.PUBLIC_TURNSTILE_SITE_KEY`（Vite 构建期内联）。
- 该变量只配置在 `wrangler.jsonc` 的 `vars`（运行时绑定），仓库无任何 `.env` 文件。
- `@astrojs/cloudflare` 的 `platformProxy` 只把 vars 暴露到运行时 `Astro.locals.runtime.env`，**不会**注入到客户端 bundle 的 `import.meta.env`。
- 核验构建产物：`dist/client/_astro/TurnstileWidget.*.js` 中 `sitekey:f` 且 `f=void 0` → `turnstile.render({sitekey: undefined})` 静默失败 → widget 不渲染（与截图一致：说明文案在、widget 空）。
- 同一机制下 `PUBLIC_R2_BASE_URL`、`PUBLIC_SITE_URL` 在客户端 bundle 中**同样是 undefined**（R2 靠同源 `/r2/<key>` 兜底才没暴露问题）。这是系统性配置缺陷。
- **决策（产品负责人确认）**：构建期 `.env` 注入，保留现有 `import.meta.env` 写法，一次修好三个变量。

### 3. 打点位置偏移（桌面 + 移动）
- 浏览器实机复现：点击点与标点中心偏差恒为 `(-22, -22)px`，正好是按钮 `size-11`(44px) 的一半。
- `AnnotateSeatmap.tsx:158` 标点按钮 className 含 `-translate-x-1/2 -translate-y-1/2`。Tailwind v4 该工具类输出**独立 CSS `translate` 属性**（`computed translate: "-50% -50%"`）。
- 同时 inline `style.transform = translate(-50%,-50%) scale(...)` 设置 `transform` 属性（`computed transform: matrix(...,-22,-22)`）。
- `translate` 与 `transform` 是两个不同 CSS 属性，浏览器叠加 → 实际偏移 -100% 而非 -50%。
- 主 Seatmap（`Seatmap.tsx`）无此 bug：其 marker 容器 className 只有 `absolute`，居中纯靠 inline transform。

## 范围（要改什么）

1. **首页跳转**：从 `index.astro` 移除 `<HomeRedirect>` 挂载与 import；删除 `src/islands/HomeRedirect.tsx`；更新 index.astro 顶部注释（移除 R10.2 redirect 描述）。`LastVenueLink.tsx`（ErrorShell 用，是链接非跳转）不动。
2. **Turnstile / PUBLIC_ 变量**：
   - 新增 `.env.development`：`PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`（always-pass 测试 key）+ `PUBLIC_SITE_URL=http://localhost:4321` + `PUBLIC_R2_BASE_URL=`（空，走同源兜底）。
   - 新增 `.env.production`：真实值（site key `0x4AAAAAADVZn5TaE3SZeI6u`、`https://seat.genchi.top`、`https://img.genchi.top`）。
   - 更新 `.gitignore`：`.env.local` 等本地覆盖文件忽略；`.env.development`/`.env.production`（仅含公开值）随仓库提交。
   - 更新 `wrangler.jsonc` 注释，澄清 PUBLIC_ 客户端值来自 `.env*`（构建期），vars 仅为运行时；同步 README 表格。
3. **打点偏移**：移除 `AnnotateSeatmap.tsx` 标点按钮 className 里的 `-translate-x-1/2 -translate-y-1/2`，居中交给现有 inline transform（与主 Seatmap 对齐）。

## 不做（Out of scope）
- 不新建 `/about` 页（spec 的 Out of Shape Scope，本次不触碰）。
- 不把 PUBLIC_ 变量改为运行时 SSR 传参（已选构建期方案）。
- 不重构主 Seatmap / 上传流程其他步骤。

## 验收标准
- [ ] 访问 `/zh`（即便 localStorage 有 last-venue）停留在说明页，不跳转；logo / 页脚关于·隐私·条款回到 `/zh` 不被弹走。
- [ ] 暂存区输入场馆名后 Turnstile widget 正常渲染；上传 Sheet Step 4 勾选后 Step 5 Turnstile 正常渲染。
- [ ] 本地 `npm run dev` 用测试 key（always-pass）；生产构建内联真实 key（核验 `dist/client` 含真实 site key 字符串）。
- [ ] 上传 Step 1 打点：标点中心落在实际点击位置（偏差 ~0px），桌面与移动一致，缩放后仍正确。
- [ ] `npm run typecheck` 通过。

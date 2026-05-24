# Journal - Sallyn (Part 1)

> AI development session journal
> Started: 2026-05-23

---



## Session 1: SeatView MVP 全栈实现

**Date**: 2026-05-24
**Task**: SeatView MVP 全栈实现
**Branch**: `main`

### Summary

完成 seatmap-real-mvp 实现阶段：task.py start 启动后分 8 步（骨架/数据/场馆页/坐席图/瀑布流+Lightbox/上传/首页+暂存+错误页/admin）经 trellis-implement 实现，trellis-check 全量验证。用户拍板两处接受偏离（手写 UI 非 shadcn、上传绑定直写非 presigned）；瀑布流按用户决策改存真实图片尺寸到 D1 不裁切。Playwright 对 astro dev 浏览器冒烟验证黄金路径（搜索/tabs/坐席图/Lightbox/上传 Sheet/主题/R10.2 跳转）。8 处 as-built 偏离 + 上传跨层契约沉淀进 spec。commit 47f40ef（123 文件）。DoD 剩部署+Lighthouse（依赖 CF 账号），任务保留 in_progress。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `47f40ef` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: SeatView 生产部署上线 seat.genchi.top

**Date**: 2026-05-24
**Task**: SeatView 生产部署上线 seat.genchi.top
**Branch**: `main`

### Summary

把 SeatView MVP 部署到 Cloudflare 生产并验证。先修复 preview/deploy 脚本（裸 wrangler dev 读根配置吐 [object Object]，改用 -c dist/server/wrangler.json，移除根 main）。用户 wrangler login 后：创建 D1(seatmap-real)/KV(RATE_LIMIT+SESSION)/R2(seatmap-images)，填真实 id + PUBLIC_SITE_URL=https://seat.genchi.top + PUBLIC_R2_BASE_URL=https://img.genchi.top + custom_domain 路由，远端 D1 migrate，npm run deploy 上线。验证：/zh/ 与场馆页 200 SSR、/api/photos 返回空数组（D1 通）、/admin + /api/admin/* 302 跳 Cloudflare Access 登录（边缘鉴权生效，用户确认可登入）。用户在控制台配好生产 Turnstile widget + 设 TURNSTILE_SECRET_KEY secret（复用为 HMAC 密钥+IP 盐）+ 接 R2 img.genchi.top 自定义域名。chrome-devtools 实测线上场馆页 LCP 1073ms/CLS 0.01。官方 Lighthouse 综合分待用户在 pagespeed.web.dev 跑（PSI 公共 API 无 key 被 429）。任务已归档。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6df2c93` | (see git log) |
| `40976da` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: 修复首页误跳转 / Turnstile 未渲染 / 打点偏移（含生产部署）

**Date**: 2026-05-24
**Task**: 修复首页误跳转 / Turnstile 未渲染 / 打点偏移（含生产部署）
**Branch**: `main`

### Summary

三处线上缺陷修复并部署 seat.genchi.top：(1) 删除 HomeRedirect island，/<lang>/ 不再自动跳转上次场馆（有意推翻 R10.2/§8，因 logo+页脚链接都指向首页导致回访者永远看不到说明页）；(2) PUBLIC_* 客户端变量改由构建期 .env.development/.env.production 注入——原先只在 wrangler.jsonc vars（运行时），import.meta.env 内联为 undefined 致 Turnstile site key 缺失、widget 静默不渲染；(3) 移除 AnnotateSeatmap 标点的 Tailwind -translate-* 类（v4 输出独立 CSS translate 属性与 inline transform 叠加成 -100%），居中统一交给 inline transform，偏移 22px→0。另查明用户报告的'上传按钮没反应'是生产旧缓存/失效 chunk，重部署后解决。沉淀两条非显然约定到 spec/frontend。生产实测四项全部通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f7894dc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 修复移动端上传相册 + 日期选择器跨年跨月

**Date**: 2026-05-24
**Task**: 修复移动端上传相册 + 日期选择器跨年跨月
**Branch**: `main`

### Summary

排查三个用户报告问题。(1) 移动端上传只能调起相机：根因 UploadSheet.tsx 的 input capture=environment，删除后对齐 shape-upload-sheet.md 的唤起本地选图。(2) 日期选择器无法快速跨年跨月：DateField.tsx 手写逐月日历增加 days/months/years 三级钻取（点头部逐级展开、点选逐级收回），保持手写+Flat-Folio、零新依赖。(3) 双语分隔符 ＼/ 经查是锁定设计（Are.na 版面式排版，spec 明确排除 /），不改。浏览器实测日期钻取链路 + DOM 核验 capture 移除，typecheck 0 errors，trellis-check 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `89f3465` | (see git log) |
| `3e562b3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

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

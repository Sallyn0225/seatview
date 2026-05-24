# 修复多语言分隔符、移动端上传相册、日期选择器跨年跨月

## Goal

修复 seatmap-real 三个用户报告的体验问题：(1) 中日双语标题的 `＼/` 分隔符观感奇怪；(2) 移动端/平板上传视角照片时只能调起相机、无法选相册/文件；(3) 日期选择器无法快速跨年跨月，只能逐月翻页。

## What I already know (from code + spec)

### Issue 1 — 双语分隔符 `＼/`
- 出现位置：`src/components/SectionHeading.astro:18`（首页 explainer 章节标题）、`src/islands/StagingForm.tsx:183,287`。
- 中日并排是**有意设计**（PRODUCT.md「双语等价 / Two Tongues Rule」，见 `i18n/locales/zh.ts:4`、`SectionHeading.astro:2`）——两条对等标题并立，不是「翻译」。
- `＼/` 分隔符是**锁定的设计决策**：`shape-home-explainer.md:254` 明确「使用 `＼/`（来自 Are.na 文化版面式排版），不用斜杠 `/`、不用竖线 `|`、不用 em dash」。用户提议的 `/` 恰是 spec 当初明确排除的 → 需用户决策（spec divergence）。

### Issue 2 — 移动端上传只能调起相机
- 根因：`src/islands/upload/UploadSheet.tsx:876` 的 `<input type="file" accept="image/*" capture="environment">`，`capture` 强制调起后置相机，阻止相册/文件选择。
- spec 实际要求相反：`shape-upload-sheet.md:172`「移动：点 dropzone 唤起本地选图（也支持直拍）」。当前实现是 bug，**去掉 `capture` 即对齐 spec**（原生 picker 仍含相机选项）。无需用户决策。

### Issue 3 — 日期选择器无法快速跨年跨月
- 现状：`src/islands/upload/DateField.tsx` 是手写逐月日历，仅上一月/下一月按钮（`:144-162`），跨年需多次翻页。
- 手写是**有意的 pragmatic deviation**：文件注释 + R4.3.6 说明「shadcn/radix 未接入，为一个可选字段不引入 react-day-picker+radix，保持 Flat-Folio 风格」。
- 用户想要「类似谷歌」按年/按月颗粒度的快速跳转 → 需在「增强手写」vs「引入成熟库」间决策（spec divergence）。

## Decision (ADR-lite)

- **Q1 分隔符**：保留 `＼/` 不动。用户原本不确定双语并排是否有意，现确认是锁定设计（Are.na 版面式排版 + 双语等价），无需改动 → Issue 1 退出实现范围。
- **Q3 日期选择器**：增强手写组件（零新依赖，保持 Flat-Folio）。在 `DateField.tsx` 内加 view 模式 `days | months | years`：点头部标签 days→months→years 逐级展开，月/年网格点选后逐级收回，实现「类似谷歌」的快速跨年跨月。不引入 react-day-picker（守住文件注释里的手写决策）。

## Requirements

- [R2] 去掉 `UploadSheet.tsx:876` 上传 input 的 `capture="environment"`，使移动端可选相册/文件/相机（对齐 `shape-upload-sheet.md:172`）。
- [R3] `DateField.tsx` 增加 days/months/years 三级视图：
  - days 视图（现状）：点中间「YYYY年M月」标签 → 进 months 视图。
  - months 视图：3×4 月份网格 + 上/下「年」翻页；点月份 → 回 days；点头部「YYYY年」→ 进 years 视图。
  - years 视图：年份网格（每页 12 年）+ 上/下「12 年」翻页；点年份 → 回 months 视图。
  - 复用现有 Flat-Folio 配色/hairline 样式与无障碍属性；today/selected 高亮逻辑沿用。

## Acceptance Criteria

- [x] 移动端/平板点击上传 dropzone 出现「相册 / 文件 / 相机」选择，而非直接进相机。
      （DOM 核验：`input[type=file]` 现为 `accept="image/*"`、无 `capture` 属性 → 移动端弹原生选择器。桌面无法直接观测移动 picker。）
- [x] 日期选择器：点头部可逐级进入月份网格、年份网格，几秒内跳到数年前/后的某月某日；点选后逐级收回到日视图。
      （浏览器实测：日→月→年→「前12年」翻页→选 2010→选 3月→选 15 日，成功设为 2010年3月15日。）
- [x] 日期组件保持 Flat-Folio 样式、无新增依赖；today/selected 高亮、Esc/外点关闭、清除按钮等既有行为无回归。
      （重开回到日视图并定位 2010年3月、15 号高亮；截图确认 hairline/无阴影样式。无 package.json 改动。）
- [x] typecheck 通过（astro check 0 errors）；桌面拖拽上传逻辑未改，Turnstile（Step 5）未触及。仓库无 lint 脚本，astro check 即质量门。

## Out of Scope

- 分隔符 `＼/` 不改（确认是锁定设计）。
- 不改双语等价原则本身（中日并排保留）。
- 不改用户内容（座位标签 / 活动名 / 描述）不翻译的规则。
- 不引入 react-day-picker / radix / shadcn。

## Technical Notes

- 相关 memory：`feedback_consult-on-spec-divergence`（偏离已写明 spec 须先与用户确认）。
- 分隔符 spec：`.trellis/tasks/archive/2026-05/05-23-seatmap-real-mvp/research/shape-home-explainer.md:122,254`。
- 上传 spec：`.../shape-upload-sheet.md:127,170-175`。

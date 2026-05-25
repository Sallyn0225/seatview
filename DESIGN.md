<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: SeatView
description: 日本演唱会场馆真实座位视角图集；克静纸面（The Quiet Folio）的双语图鉴。
---

# Design System: SeatView

## 1. Overview

**Creative North Star: "The Quiet Folio · 静纸"**

SeatView 是一本被粉丝持续增补的图鉴书 —— 用户翻到任意场馆的坐席图，点开任一标注点，就能看到由其他粉丝从那个真实座位拍下的视角。Folio（大开本对折装订，是地图集、摄影集、植物图鉴的传统纸本形态）是这个产品的精神原型；"静"对应 PRODUCT.md 反复强调的克制 —— 抢票前 30 秒的零摩擦、chrome 在用户注视照片时褪到背景、严肃 UI 让位于真实图像。

中日双语是 SeatView 的两条核心轨道，不是"主语言 + 翻译"。整本图鉴可以从任意一种语言读起；切换语言不是切换"翻译版本"，而是切换"另一种地道的本子"。中文与日文使用同源字体家族（Noto Serif SC ↔ JP；Noto Sans SC ↔ JP），整本书的呼吸节奏保持一致。

英语 / 韩语（2026-05 增补）是一层**可达性翻译层**，不属于上述双语等价模型：`zh↔ja` 维持等价双轨与 Noto 同源字体；`en/ko` 面向海外浏览者，提供地道翻译但**单标题不并排副标题**。韩文（한글）使用**系统字体栈兜底**（Noto KR → Apple SD Gothic Neo / Malgun Gothic，不引 webfont、零额外边缘流量），拉丁文沿用现有 serif/sans。下文 The Two Tongues Rule 仅约束 `zh↔ja`。

这本图鉴明确拒绝三类气质：日本票务 / Live 资讯站的 90 年代 BBS 拥挤排版（eventernote、livefans.jp、ticket.pia、e-plus）；标准 SaaS 模板的紫蓝渐变 + hero metric 卡片网格；以及"极简到冷漠"的纯白 + 纯黑 + 无温度 chrome。克制 ≠ 没人住过 —— "缝隙时刻"（空状态、上传成功、第一次访问说明）允许一句温柔的文案、一个克制的图形点缀。

**Key Characteristics:**
- 照片占据每个详情视图 ≥70% 视觉重量；UI 是背景
- 中日双语等价，互不为对方的翻译
- 主流 UI 严肃克制，缝隙时刻允许小幅度的人情味
- 移动端单手可达；桌面端的图鉴感更厚
- 深度通过排版与色彩加深表达，不通过阴影
- 信任靠流程透明，不靠账户体系

## 2. Colors

色彩策略：**Restrained** —— 暖偏中性主色 + 一抹尚未敲定的强调色（≤10% 屏幕面积）。

### Primary

- **Sumi Ink · 墨黑** `[exact value to be resolved during implementation]`：不是 `#000`，而是 OKLCH 中偏暖的近黑（参考 lightness ~18-22%，hue 微偏暖色调，chroma 0.005-0.01）。承担主要文本、坐席图轮廓线、严肃 chrome（导航、操作按钮的文字）。

### Neutral

- **Warm Rice Paper · 暖米白** `[exact value to be resolved during implementation]`：muji 米白 / 米和纸色感，OKLCH lightness ~96-98%，chroma 0.005-0.01 微暖。承担主要背景 —— 整本图鉴的纸面。
- **Folio Cream · 纸面奶色** `[exact value to be resolved during implementation]`：比米白略深一档（lightness ~92-94%）。承担次级背景、内容分层、移动端 sheet 的表面色，用于在不引入阴影的前提下区分前后景。
- **Hairline Ash · 灰发线色** `[exact value to be resolved during implementation]`：lightness ~75-82%。承担细线分隔（场馆树之间的分隔线、列表行之间的发丝线）、低强度边框。

### Accent

- **TBD Accent** `[hue family to be chosen at implementation: 朱赤 / 藏青 / 苔绿 中选一]`：占任意一屏 ≤10% 面积，承担唯一强调 —— 当前选中的坐席标注点、关键 CTA 在按下时的状态、上传成功的颗粒高光。OKLCH chroma 控制在中等饱和（参考 0.10-0.18），不允许霓虹感。

### Named Rules

**The Ink-and-Paper Rule.** 主体 UI 仅由「墨」与「纸」两种色感组成。Accent 是这本图鉴里"被精心保留的一抹颜色"，绝不可日常使用 —— 它的稀有性就是它的意义。

**The No-Pure-Black-or-White Rule.** 禁止 `#000` 与 `#fff`。所有中性色必须在 OKLCH 中带 0.005-0.01 的暖色调倾斜；纯白在屏幕上反而冷漠，纯黑在 OLED 上撕裂图片的连续感。

## 3. Typography

**Display Font:** Noto Serif JP / Noto Serif SC `[final stack to be confirmed at implementation]`
**Body Font:** Noto Sans JP / Noto Sans SC `[final stack to be confirmed at implementation]`
**Label / Numeric Font:** `[possibly JetBrains Mono or IBM Plex Mono for 座位号 / 日期 / 上传时间; to be confirmed]`

**Character:** Serif 承担图鉴的"书名页"雅气 —— 场馆名、章节性标题、第一次访问的说明页 hero。Sans 承担正文、列表、表单与所有抢票路径上的可读性。两者必须来自 Noto 同一家族，中日同源；不允许中文用一种字体、日文用另一种字体。

### Hierarchy

`[scale steps to be specified at implementation]`

约束（来自 shared design laws）：

- Body 行宽上限 65-75ch
- Display / Headline / Title / Body / Label 各级之间字号比 ≥1.25
- 座位号、演出日期、上传时间这类等距数字优先用 tabular-nums（若用 Sans）或 Mono 字体

### Named Rules

**The Two Tongues Rule.** 中文与日文必须使用 Noto 同一字体家族的同源版本（Noto Serif SC ↔ Noto Serif JP；Noto Sans SC ↔ Noto Sans JP）。绝对禁止"中文一种字体、日文另一种" —— 切换语言时排版气质必须保持一致，整本图鉴像同一只手装订。**本规则仅约束 `zh↔ja`**；en/ko 辅助层的韩文/拉丁字体策略见 Overview（系统字体栈兜底）。

**The Folio Title Rule.** Serif 仅在以下场景出现：场馆名（一级标题）、演出名（章节标题）、第一次访问说明页的 hero 文案。其他一律 Sans。Serif 是图鉴书名页的雅气，不是日常 UI 的装饰。

**The Photo-Caption Rule.** 在 Lightbox 中，照片是焦点、文字是脚注 —— `seat_label` / 演出日期 / 描述的字号、颜色、间距都要明显低于照片的视觉重量。任何让元数据与照片争重的排版都是失败。

## 4. Elevation

平面（Flat by default）。SeatView 是一本被翻开的图鉴书页 —— 纸本上没有阴影。用户上传的照片本身已经承载了真实空间的纵深感，UI 不需要再制造虚假的层次。

深度只在两种情况下出现：

- 用户主动触发 Lightbox / 上传 Sheet 时，背景出现一层墨色半透明 overlay（不是阴影，是一层墨水），明确告诉用户"现在聚焦在这件事上"。
- 状态切换时通过色彩加深表达 —— 选中态是"该处的纸张吸了更多墨"，不是 `box-shadow`。

### Named Rules

**The Flat Folio Rule.** 默认所有表面平面。深度仅来自：（1）照片本身的内容、（2）用户主动触发的 overlay、（3）状态切换时的色彩加深。禁止 `box-shadow` 作为装饰元素。glassmorphism 永久禁止。

## 5. Do's and Don'ts

### Do

- **Do** 让照片占据每个详情视图 ≥70% 的视觉重量。chrome（标题、按钮、面包屑、tab）必须能在用户注视图片时褪到背景。
- **Do** 在"缝隙时刻"（空状态、上传成功、初次访问说明、错误提示）允许小幅度的人情味：一句温柔的文案、一个克制的图形点缀。判断准则 —— 用户在完成任务途中看到的东西必须不打扰；用户在"暂停的瞬间"看到的东西可以有人味儿。
- **Do** 中文与日文使用 Noto 同源字体家族；切换语言时排版气质保持一致。
- **Do** 在 OKLCH 中给所有中性色加 0.005-0.01 的暖色调倾斜。
- **Do** 把"为什么"用一句话写在 UI 里：上传时为什么要勾版权同意（CC BY-NC 4.0）、为什么要 Turnstile、IP 限频 10 张/天 —— 信任靠透明而非账户体系。
- **Do** 严格遵守 `prefers-reduced-motion`：聚合点放大 + 散开（ADR-4）在 reduced motion 下降级为即时跳转。
- **Do** 关键触达区域（语言切换器、坐席图标注点、上传按钮）保持 ≥44×44px。
- **Do** 用 inline 优先、sheet/drawer 其次、modal 最后的顺序选择交互形态。上传流程必须是 sheet/drawer，不是层层弹窗。
- **Do** 在文案中使用第二人称、平实、不卖弄、不感叹的声音。

### Don't

- **Don't** 复制日本票务与 Live 资讯站的拥挤老旧排版（eventernote、livefans.jp、ticket.pia、e-plus）：90 年代 BBS 排版、滚动公告条、广告位与内容混排、密集小字堆叠。
- **Don't** 走标准 SaaS 渐变模板：紫蓝渐变 hero、big-number + small-label 卡片网格、icon + heading + 三行说明的卡片重复、彩色渐变 CTA。SeatView 是一个图鉴工具，不是 SaaS 产品演示页。
- **Don't** 滑向极简冷漠：纯白底 + 纯黑字 + 无任何温度的 chrome。克制 ≠ 没人住过。
- **Don't** 使用社交平台式喧闹的元素：follow 按钮、彩色徽章、推送红点。SeatView 无注册系统、不做评论评分，UI 不能假装有这些功能。**唯一刻意例外**：暂存区「+1 附议」是维护者的需求信号而非社交点赞 —— 克制呈现（muted "N 人想看" + Sumi「✓ 已附议」，绝不用朱赤或彩色徽章；朱赤仍只留给提交 / 投稿 CTA）。见 task 05-25-1。
- **Don't** 把 modal 当作第一反应。除了 Lightbox（图片预览天然需要全屏聚焦），其他能 inline 就 inline。
- **Don't** 使用 `#000` 或 `#fff`。
- **Don't** 使用大于 1px 的 `border-left` / `border-right` 作为彩色装饰条。
- **Don't** 使用 `background-clip: text` 做渐变文字；强调通过字重或字号，不通过渐变。
- **Don't** 用 `box-shadow` 作为装饰（仅允许在主动状态切换时通过色彩加深表达深度）。
- **Don't** 用 glassmorphism。
- **Don't** 写「请」「敬请」这类过度礼貌堆叠，也不写「亲」「小可爱」这类社交平台式套近乎；日文不用机翻腔，不用"中文写好再翻日文"的语序。
- **Don't** 在文案中使用 em dash（—）或 `--` 作替代。用逗号、冒号、分号、句号、括号。
- **Don't** 让任何元数据（座位号、日期、活动名）的视觉重量接近照片本身。

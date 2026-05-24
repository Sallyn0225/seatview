# Shape Brief — 错误页（404 / 通用错误 / 离线 inline 重试）

> 来源：`/impeccable shape 404 / 离线 / 通用错误页` 产出，用户已确认三处核心决策（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：(a) 全屏错误 shell（404 + 500/通用，共用一套组件）；(b) 离线 / 加载失败的**页面内 inline 重试共享态**（供瀑布流 / Lightbox / 暂存名录 / 坐席图数据复用）。覆盖 PRD 未明确设计的错误兜底层。
> **顶部 chrome + footer 复用 [`shape-home-explainer.md`](shape-home-explainer.md)，不重复定义。后端错误响应结构归 [`.trellis/spec/backend/error-handling.md`](../../../spec/backend/error-handling.md)，本 brief 消费之，不重复定义。Astro / Worker 的 404/500 路由装配实现归后端，本 brief 仅定义渲染契约。**

## 1. Feature Summary

SeatView 的错误兜底层，覆盖三种失败：**404 找不到页面**（`src/pages/404.astro` 全 SSR）、**通用错误页**（500 / 未预期异常，与 404 共用同一全屏 shell）、**离线 / 加载失败的 inline 重试态**（不是独立页，沿用既有「整批失败 60s 静默重试」模式；PRD「Out of Scope」已把「离线模式 / PWA」明确排除）。

核心命题：错误页是 DESIGN.md 点名的「缝隙时刻」，是全站除上传成功页外最该集中出现人情味的位置；但温度档位定在**「一处克制图形」** —— Sans + 一处自绘 Folio「缺页 / 折角」墨线，**不破例 Serif**（守 Folio Title Rule 与 Serif 稀有性，与暂存区同纪律），**不出现朱赤**（守朱赤"坐席图标注点 selected + 上传 / 暂存提交按钮"的语义垄断）。

## 2. Primary User Action

「我撞到一条死路（打错 URL / 失效链接 / 网络抖动 / 服务异常），在不被指责、不被技术黑话吓到的前提下，一步回到能继续看图的地方。」主操作是**回到可用状态**（打开图鉴 / 回到上次场馆 / 重试），不是阅读错误详情。

## 3. Design Direction

- **Color strategy**：**Restrained**。全错误层只用 Sumi Ink / Warm Rice Paper / Folio Cream / Hairline Ash 四档中性。**朱赤完全不出现**（同首页 / 瀑布流 / Lightbox）—— 错误页不是贡献动作，无朱赤资格；恢复 / 重试按钮走**墨黑 outline**（同首页 CTA），不是朱赤 tinted fill。
- **Theme**：Light-first（继承全站）。Dark 在 `/impeccable adapt` 阶段统一补。
- **Theme scene sentence**：「一名粉丝在抢票前几分钟、地铁里点开朋友转发的座位链接，结果链接失效、网突然卡住 —— 他本就紧张，屏幕上任何冰冷的『404 Not Found』或红色报错都会放大焦虑；他需要的是一页安静、不指责、一眼能点回图鉴的纸面。」→ Light-first；高压紧张心境 → 文案必须去技术化、不归罪、给一条明确的回去的路；摩擦要低。
- **Anchor references**：
  - **muji 缺货 / 错误页** —— 极简、不慌张、一句话 + 一个回去的动作
  - **Are.na 404** —— 工具型站点文字主导的错误页，不卖弄不营销
  - **新增：日式「乱丁 / 落丁」缺页隐喻** —— Folio 图鉴精神原型派生：404 / 500 是「这本图鉴缺了 / 装订错了一页」，折角缺页墨线是这个隐喻的唯一视觉锚。

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Decisions Locked（2026-05-24）

用户在 shape 阶段确认的三处骨架决策：

1. **温度档位 → 一处克制图形**。Sans + 一处自绘 Folio「缺页 / 折角」墨线点缀；温度靠文案 + 留白 + 这一处图形。不破例 Serif、不用朱赤。（否决「纯排版克制」—— 全屏会偏冷像 dev demo；否决「Folio Serif 缺页时刻」—— 不愿打破 Serif 稀有性、不改 Folio Title Rule 的「唯一」声明。）
2. **离线形态 → inline 失败 + 重试**。不做独立离线页、不做全局横幅、不做 PWA（PRD Out of Scope）。沿用并**统一**既有「整批失败 60s 静默重试」模式（photo-grid / lightbox / staging 已各自有），收敛成一套共享的页面内「加载失败 + 重试」词汇。
3. **404 语义 → 全部统一通用**。不区分 venue-not-found 与普通路径；所有 404 用同一句通用文案 + 回图鉴。（否决把 `/v/[未知场馆]` 引向暂存区的特殊化 —— 实现最简，也避免对"打错的 venue id"过度臆测用户意图。）

派生决策（由上述三条 + 跨 brief 一致性强制推出）：

- **404 与 500 共用同一「错误 shell」组件**，仅文案 + 状态码不同。不为 500 单独设计版式；折角缺页墨线两者通用（404 = "缺了这一页"，500 = "这页装订出了点问题"，隐喻都成立）。
- **恢复 / 重试按钮 = 墨黑 outline**，不是朱赤 tinted fill。打开图鉴 / 回上次场馆 / 重试都是"导航 / 恢复"动作，非贡献动作 → 无朱赤；与暂存区 / 上传的朱赤提交按钮显式区分。规格沿用 home-explainer 的 CTA 墨黑 outline。
- **离线 inline 态不复用全屏 shell**。它出现在现有页面内容区（瀑布流网格位 / Lightbox 图位 / 暂存名录位 / 坐席图数据），是一小块就地提示 + 重试，不接管全屏、不跳转、不弹 toast。全屏 shell 只给真正的路由级 404 / 500。
- **404 页必须自检语言**。`404.astro` 在 pages 根（不在 `[locale]/` 下，见 `cloudflare-astro-stack.md` 目录结构），拿不到 `[locale]` 路由参数 → 须从 URL 路径段 / cookie / Accept-Language 自行判定当前语言（见 §9 断言：检测语言为主 + 另一语言次级一行）。
- **复用顶部 chrome + footer**（继承 home-explainer），chrome 仅保留 logo + 语言 + 主题（无场馆树，同首页 / 暂存居中布局）。**500 页 chrome 须纯静态、不依赖任何数据 / API**，避免"错误页本身又报错"。
- **零图像资源**。折角缺页是 inline SVG 墨线（`currentColor`，随主题深浅适配），非 raster。占位 / 失败一律 Folio Cream 块，不画 shimmer（继承瀑布流）。

## 5. Scope

- **Fidelity**：production-ready。
- **Breadth**：全屏错误 shell（404 + 500 / 通用）整页 + 离线 / 加载失败 inline 重试共享组件。**不含**：chrome / footer 本体（复用）、各 island 自身的数据获取逻辑（本 brief 只定义其失败态的统一视觉与交互契约）、后端错误响应结构（归 `backend/error-handling.md`）、Astro / Worker 的 404 / 500 路由装配实现（本 brief 定义渲染契约）。
- **Interactivity**：shipped-quality（三档响应式、键盘可达、深浅色继承、reduced-motion 降级、离线 inline 的网络重试逻辑）。
- **Time intent**：polish 到可直接交给 trellis-implement 落地。

## 6. Layout Strategy

### 全屏 shell · 桌面（≥1024px）

```
┌───────────────────────────────────────────────┐
│  [SeatView]                    [ja│zh]  [☀/🌙] │  sticky chrome（复用；无场馆树）
├───────────────────────────────────────────────┤
│                                                 │
│                ┌ ─ ─ ─ ┐                        │
│                │       ╲   ← 折角缺页墨线 SVG    │
│                └ ─ ─ ─ ┘     (currentColor,~64px)│
│                                                 │
│            这一页找不到了                         │  ← Sans 600 26px（检测语言为主）
│            このページは見つかりません              │  ← Sans 400 15px（另一语言次级一行）
│                                                 │
│        链接可能失效了，或者地址打错了。            │  ← Sans 15px Hairline 说明
│                                                 │
│        [ 打开图鉴 ]   回到上次看的场馆            │  ← 墨黑 outline 主按钮 + 文本链接(localStorage 有才显示)
│                                                 │
├───────────────────────────────────────────────┤
│  GitHub · 关于 · 隐私政策 · 服务条款             │  footer（复用 home-explainer）
│  © SeatView · 真实视角图集                       │
└───────────────────────────────────────────────┘
```

- **主区 680px 居中**（同首页 / 暂存，阅读流非图像流）。
- 折角墨线置于标题上方 ~32px，~64px 见方，1.5px 墨线描边、不填充。
- 视觉重心略偏上（~40% 高度），chrome 与 footer 间留白充足，不把所有元素堆死正中。

### 平板（768-1023px）

主区 568px 居中；标题缩到 22px；墨线 ~56px；恢复动作仍同行；其余同桌面。

### 移动端（<768px）

- 顶部 chrome 简化为 `[SeatView] [ja│zh] [☀]`（复用首页移动 chrome）。
- 左右 padding 24px；主区 100%。
- 标题缩到 20px；墨线缩到 ~48px。
- **恢复动作纵排**：`[打开图鉴]` 全宽墨黑 outline（≥44px 高，触达达标）→ 下方「回到上次看的场馆」文本链接。

> 500 / 通用版式同 404，仅折角墨线含义转「装订错页」、文案不同（见 §9）。

### 离线 inline 态（嵌现有容器，不接管全屏）

```
   ┌─────────────────────────────────┐
   │     现在加载不出来。              │  ← Sans 14px Sumi
   │     连接恢复后再试一次。          │  ← Sans 13px Hairline
   │     [ 重试 ]                     │  ← 墨黑 outline 小按钮
   └─────────────────────────────────┘
   （Folio Cream 块占位，不画 shimmer）
```

- 替换的是容器内"本该出现内容"的那块区域，尺寸随宿主容器（瀑布流 / Lightbox 图位 / 名录 / 坐席图数据）。
- 不弹 toast、不跳转、不接管全屏。

## 7. Key States

| 区域 | 状态 |
|---|---|
| 全屏 shell | default(404) / default(500 通用) / reduced-motion（墨线 draw-in 渐显改即时） |
| 折角墨线 | 静态（默认）/ 可选极轻 draw-in 渐显（~400ms ease-out）/ reduced-motion 即时；无循环无弹跳 |
| 主按钮「打开图鉴」 | default / hover（墨色加深一档）/ focus(2px ring) / pressed；原生 `<a href>` |
| 次级「回到上次场馆」 | localStorage 有 last-venue → client 水合后渲染文本链接；无 → 整行不渲染 |
| chrome / footer | 复用 home-explainer（sticky 96% opacity Warm Rice Paper + 1px Hairline 底边，非 glassmorphism） |
| 离线 inline | 加载中（Folio Cream 占位，不 shimmer）/ 失败首现（就地提示 + 重试按钮）/ 重试中（按钮转「重试中…」+ 禁用）/ 重试成功（内容替入）/ 反复失败（60s 后静默自动重试一次，继承瀑布流，不无限弹） |
| 整体 fallback | 404 / 500 shell 是 SSR 静态可读；「打开图鉴」是原生 `<a>` 无 JS 可用；「回到上次场馆」依赖 localStorage 需 JS，无 JS 时不显示该行 |

## 8. Interaction Model

### 渲染

- **404** → `src/pages/404.astro`，全 SSR，**自检语言**（URL 路径段 → cookie → Accept-Language）。
- **500 / 通用** → Worker / Astro 错误处理渲染同一 shell 组件（纯静态，不依赖数据 / API）。
- **离线 inline** → 各 island 在 fetch 失败（网络错误 / 5xx）时就地渲染共享 `<LoadFailure onRetry />`。**4xx 不走重试**（继承 ADR-12：4xx 不重试，直接报错）。

### 恢复动作

- 「打开图鉴」→ 跳 `/[lang]/`（首页），原生 `<a>`。
- 「回到上次看的场馆」→ client 水合读 `localStorage` last-venue（key 以 `state-management.md` 的 `seatview:*` 约定为准）→ 有则文本链接跳 `/[lang]/v/[id]`；无则整行不渲染。SSR 阶段不渲染（404 SSR 不知 localStorage），水合后注入。

### 重试（离线 inline）

- 点重试 → 重发该容器数据请求 → 成功替入 / 再失败回到失败态。
- 反复失败 → 60s 后静默自动重试一次（继承「整批失败 60s 静默重试」），不弹 toast、不打扰。

### 键盘

- **shell**：Tab → chrome → 打开图鉴 → 回上次场馆(若有) → footer。Enter 激活。**无 Esc**（本页无 modal / sheet，守模态优先反例）。
- **离线 inline**：重试按钮进所属容器的 Tab 序；Enter / Space 激活。

### Reduced motion

- 墨线 draw-in 渐显 → `prefers-reduced-motion: reduce` 下改即时显示。
- 离线 inline 切换本就无动效。

### i18n

- shell 标题 / 说明 / 按钮中日双语。404 自检语言后渲染对应语言为主 + 另一语言次级一行（见 §11 断言）。
- 离线 inline 文案随宿主页面当前 locale。

## 9. Content Requirements

### 图像 / 视觉资源

- **零图像资源**（同首页 / 暂存）。唯一 inline SVG：折角缺页墨线（`currentColor`，`aria-hidden`，装饰性）。
- 占位 / 加载 / 失败一律 Folio Cream 块，不画 shimmer（继承瀑布流，拒绝 SaaS 模板语言）。

### 双语文案（zh / ja，等价不翻译）

去技术化、不归罪、不感叹、不写「请 / 亲」，无 em dash，不渲染异常堆栈 / 用户路径给前端。

| 位置 | 中文 | 日本語 |
|---|---|---|
| 404 标题 | 这一页找不到了 | このページは見つかりません |
| 404 说明 | 链接可能失效了，或者地址打错了。 | リンクが切れているか、アドレスが違うようです。 |
| 500 / 通用 标题 | 这一页出了点问题 | このページで問題が起きました |
| 500 / 通用 说明 | 不是你的问题。稍后再打开看看。 | あなたのせいではありません。少し時間をおいて開いてみてください。 |
| 主按钮（回首页） | 打开图鉴 | 図鑑をひらく |
| 次级链接（localStorage 有） | 回到上次看的场馆 | 前回見ていた会場へ戻る |
| 离线 inline 标题 | 现在加载不出来。 | 今は読み込めません。 |
| 离线 inline 说明 | 连接恢复后再试一次。 | 接続が戻ったら、もう一度お試しください。 |
| 重试按钮 | 重试 | 再読み込み |
| 重试中 | 重试中… | 読み込み中… |

> 文案与既有 brief 错误文风一致（上传 Sheet / 瀑布流 / 暂存的「克制、不归罪、不卖萌」）。「打开图鉴 / 図鑑をひらく」复用 home-explainer 的 CTA 文案。

### 动态范围 / 安全

- 404 标题 / 说明对所有未命中路由**通用**，不插入用户输入的路径（防 XSS、防臆测用户意图）。
- 500 文案不渲染任何异常堆栈 / 错误码给用户；技术细节进 Worker 日志（见 `logging-guidelines.md`）。

## 10. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载 `.claude/skills/impeccable/reference/` 下：

- `interaction-design.md` —— 离线 inline 重试状态机、focus 管理、恢复动作
- `color-and-contrast.md` —— 墨黑 outline 对比度、四档中性、折角墨线 currentColor 深浅适配
- `spatial-design.md` —— 680px 居中、墨线与标题 / 动作的垂直节奏、重心偏上
- `responsive-design.md` —— 三档断点（≥1024 / 768-1023 / <768）恢复动作纵排、墨线缩放
- `typography.md` —— **确认 shell Sans-only**（守 Folio Title Rule，同暂存）、双语标题层级

task-local 已存在 brief：

- `shape-home-explainer.md` —— chrome / footer 契约、680px 列、「打开图鉴」墨黑 outline 规格、`＼/` 中日并排约定、localStorage last-venue 跳转机制
- `shape-photo-grid.md` —— 「整批失败 60s 静默重试」原型、Folio Cream 占位不 shimmer、不弹 toast 的不打扰原则（离线 inline 直接继承）
- `shape-staging-page.md` —— Sans-only 纪律来源、克制错误文风

后端 / 前端 spec：

- `.trellis/spec/backend/error-handling.md` —— 错误响应结构（离线 inline 消费）、4xx / 5xx 区分
- `.trellis/spec/backend/logging-guidelines.md` —— 500 不向用户暴露堆栈、技术细节进日志
- `.trellis/spec/frontend/state-management.md` —— localStorage key 命名（`seatview:*`, last-venue）、客户端水合读取

## 11. Open Questions

无真正未决，剩余已断言默认（实施时若有真机调参可微调）：

- **【断言】404 文案呈现 = 检测语言为主 + 另一语言次级一行**（而非强制中日并排双标题）。理由：404 多由站外链接 / 打错 URL 触发，用户语言意图弱，以检测结果为主更顺；保留另一语言一行兜底（守双语等价精神）。若要改强制并排，实施时一行调整。
- **【断言】折角墨线静态优先**，可选极轻 draw-in（~400ms ease-out）渐显，reduced-motion 即时。不做循环 / 弹跳动效。
- **【断言】500 不给「重试」主按钮**（SSR 错误重试需整页刷新、价值低且可能再错），主按钮统一「打开图鉴」+ 次级「回上次场馆」。「重试」只属于离线 inline（数据级、可局部恢复）。
- **【断言】离线检测不依赖 `navigator.onLine`**（Q2 已否决全局横幅），仅在实际 fetch 失败时就地显示 —— `navigator.onLine` 不可靠，以真实请求结果为准。
- **【跨 brief 回写】** photo-grid / lightbox / staging / seatmap 的「加载失败」态统一收敛到本 brief 定义的共享 `<LoadFailure>` 组件；它们已各自描述的失败文案以本 brief 文案表为准（去重）。实施这些组件时回头对齐。

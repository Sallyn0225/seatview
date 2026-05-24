# Shape Brief — 瀑布流卡片（Photo Grid）

> 来源：`/impeccable shape 瀑布流卡片` 产出，用户已确认（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：场馆页底部的 masonry 瀑布流容器 + 单卡组件 + 全部状态 + 加载/空/尾态 + 响应式 + 跨组件信号入口。**不含**：单卡点击后的 Lightbox 行为（见 [`shape-lightbox.md`](shape-lightbox.md)）；瀑布流在场馆页内的容器边界与上下文（见 [`shape-venue-page.md`](shape-venue-page.md)）；坐席图与 Lightbox 之间的 `selected` 信号契约本体（见 [`shape-seatmap-component.md`](shape-seatmap-component.md)）。

## 1. Feature Summary

场馆页底部 surface（PRD R3.9 / venue-page §5 §7）：把当前 sub-map 下所有用户上传的真实座位视角照片，按上传时间倒序排成响应式 masonry。它是坐席图标注点的「展开列表视图」—— 同一份数据的两种入口：点标注点是「按空间检索」，刷瀑布流是「按时间扫一遍」。两个入口共用同一 Lightbox 实例，行为差异由 Lightbox brief 承担。

## 2. Primary User Action

「**用极小的视觉成本扫到一张接近自己想买座位号的照片**」→ 点开 Lightbox 看完整视角。整个卡片单元的全部设计目的就是这一个动作的密度与速度。其他动作（看活动名 / 看上传时间 / 看完整描述）都是次级，全部委托给 Lightbox。

## 3. Design Direction

- **Color strategy**：Restrained（继承 DESIGN.md），无 per-surface override。瀑布流是中性灰阶的展示容器，**朱赤强调色不进入这个 surface** —— 不出现在 caption、不在 hover、不在加载状态、不在尾部句号。这块 surface 把朱赤完全让给坐席图标注点与上传按钮，守护朱赤的语义垄断。
- **Theme scene sentence**：「一位粉丝在地铁通勤的最后 5 分钟单手刷手机，屏幕亮度跟随系统自动，目标是『快速看看 23 号附近别人拍的视角长什么样』—— 这是浏览态、不是焦点态，UI 应该退到接近不可见，让照片自己成为唯一的信号源。」光线场景 → 跟随系统主题，亮色优先（Warm Rice Paper 纸面）。
- **Anchor references**（具体物件，非形容词）：
  - **[Are.na](https://www.are.na/)** 的图块密度与冷静（克静纸面上排列的图块本身就是边界）
  - **[cinra.net](https://www.cinra.net/)** 文化栏目页底部的图片流（图鉴书页式的呼吸节奏）
  - **Cookpad UED blog** 的卡片节奏（标准 gap、单行 caption、无装饰边界）

反例（必须避开）：Pinterest 的过密 + chip overlay + 阴影；SaaS 卡片网格的 icon + heading + 三行说明；票务/Live 资讯站的密集小字堆叠 + 广告位混排。

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Scope

- **Fidelity**：production-ready
- **Breadth**：瀑布流容器本体 + 单卡组件 + 所有状态（default / hover / focus / pressed / selected / loading / error / 渐入追加 / empty / end）+ 响应式断点（1 / 2 / 3 / 4 列）+ 跨组件信号入口
- **Interactivity**：shipped-quality（含键盘 Tab/Enter/Space、`prefers-reduced-motion` 降级、IntersectionObserver 自动加载、img onerror fallback）
- **Time intent**：直接交给 trellis-implement 落地

## 5. Layout Strategy

### 容器

- **库**：`react-photo-album` `layout="masonry"`（继承 venue-page brief + frontend-libraries.md §C 选型）
- **响应式列数**：
  - `<768px`（移动）→ 1 列
  - `768-1023px`（平板）→ 2 列
  - `1024-1279px`（桌面小）→ 3 列
  - `≥1280px`（桌面大）→ 4 列
- **容器宽度**：跟随 venue-page 主区（最大 900px 居中），与坐席图同一视觉栏宽
- **gap**：桌面 `20px` / 平板 `16px` / 移动 `12px`（用户已锁定 — 拒绝 Pinterest 紧凑 12/8 与图鉴稀疏 32/16，取中道）
- **首批渲染**：12 张 SSR 直出 HTML；后续每批 24 张滚动加载
- **底部哨兵**：在容器底部 ~600px 处放一个 IntersectionObserver 哨兵元素触发下一批 fetch

### 单卡结构

```
┌─────────────────┐
│                 │
│   照片          │  ← object-fit 不裁切，保留用户上传的纵横比
│                 │
└─────────────────┘
  E列 23番         ← Sans 13px / Sumi Ink lightness +15% / 4px top-margin
```

- **照片**：用户上传原始纵横比保留（不裁切，"真实"高于"齐整"），sharp 角（无 `border-radius`），无 `border`，无 `box-shadow`（DESIGN.md Flat Folio Rule）
- **照片下方留白**：`margin-top: 4px`（用户已锁定 B 选项：无 Hairline Ash 装饰底线，更克制）
- **caption**：单行 `seat_label`，原文不翻译（PRD R9.5 用户内容保持原文）
  - 字体：Sans
  - 字号：`13px`（移动端 `12px`）
  - 颜色：Sumi Ink（基础 lightness +15%，比正文 body 略淡一档，强调"脚注"语义）
  - 单行省略：`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
- **可点击/可聚焦 target**：照片 + caption 共同构成一个 `<button>` 或 `<a>` 包裹的整体（不分离），确保键盘 Tab 一次到一张卡片

### 卡片之间的视觉边界

- **仅靠 gap 区分**，无 border / 无 shadow / 无 corner —— 照片自身的边缘即是边界（Are.na 做法）
- 这一条与 DESIGN.md Flat Folio Rule 直接对应：「禁止 `box-shadow` 作为装饰；状态切换仅通过色彩加深表达深度」

## 6. Key States

| 状态 | 视觉描述 | 用户感受到 |
|---|---|---|
| **default** | 照片 + 一行 caption（`seat_label`），`cursor: pointer` | 一目了然的图鉴书页 |
| **hover**（桌面） | 照片 `filter: brightness(1.02)`，250ms `ease-out-quart`；caption 无变化（用户已锁 A） | 极轻的「这张可点」翻图鉴书页式提示 |
| **focus**（键盘） | 照片外 `outline: 2px Sumi Ink; outline-offset: 2px`，无照片亮度变化 | 键盘用户能清楚看到当前焦点位置 |
| **pressed** | 照片 `filter: brightness(0.98)`，即时切换；松开恢复 | 即时按下反馈，不延迟 |
| **selected**（Lightbox 当前正在显示该卡片对应的照片） | 照片持续 `filter: brightness(0.95)` + caption 文字加重到 `font-weight: medium` | 「我刚才打开/正在看的是这张」的视觉书签 |
| **loading**（照片本身 lazy load 未到） | Folio Cream 占位块，按图片实际宽高比预留高度（避免布局 CLS）；**不画 shimmer 动画**（克静纸面，shimmer 是 SaaS 模板语言） | 占位安静、不干扰 scan |
| **error**（`<img onerror>` 触发） | Folio Cream 占位块保留 + 居中 Sans 12px Hairline Ash 文字：「图片暂时无法显示 / 画像を表示できません」；caption 仍正常显示 `seat_label` | 单卡失败不影响其他卡 |
| **追加渐入**（每批新 24 张到达） | 新卡片以 `opacity: 0 → 1`，200ms `ease-out-quart` 渐入；container 不出现 spinner / loader / 「加载中…」文字 | 静默的连续阅读体验，符合"零摩擦" |
| **empty**（该 sub-map 一张照片都没有） | 单行 Sans 14px 居中，Sumi Ink lightness +30% 文字：「这一层还没有粉丝分享视角。要做第一个吗？」/「このエリアにはまだ視点投稿がありません。最初の一枚を投稿しますか？」；"要做第一个吗？" / "最初の一枚を投稿しますか？" 是文本链接，点击触发上传 Sheet | 缝隙时刻允许人情味（DESIGN.md 已批准） |
| **end**（无更多照片可加载） | 容器底部单行 Sans 12px Hairline Ash 居中：「以上是这一层目前的全部分享。」/「ここまでがこのフロアの全投稿です。」；**无 divider line、无图标、无装饰** | 「我已经看完了」的明确句号 |
| **reduced motion** | hover brightness 过渡降级为即时切换（0ms）；新卡片渐入降级为即时 `opacity: 1`；selected 切换即时无过渡 | 严格尊重 `prefers-reduced-motion` |

## 7. Interaction Model

### 点击卡片

- 点击照片任意位置（或 caption） → 打开 Lightbox（瀑布流入口模式，允许左右翻页，详见 shape-lightbox.md §7 "双入口语义"）
- Lightbox 入口参数：当前点击的 `photo.id` + 该 sub-map 全部照片的 `photo.id[]` 序列（用于翻页）
- 同时通过 Lightbox 状态机向坐席图广播 `selected_photo_id` → 坐席图对应标注点切到 selected 态（信号契约见 shape-seatmap-component.md §3.2 和 shape-lightbox.md §7 "跨组件信号"）

### 键盘

- **Tab 顺序**：按瀑布流自然顺序（行内从左到右、行间从上到下；masonry 模式下按 DOM 顺序，与上传时间倒序一致）
- **Enter / Space**：在焦点卡片上触发打开 Lightbox（与点击同语义）
- 不需要方向键导航（避免与浏览器原生滚动冲突；用户已经用 Tab + 滚轮足够）

### 滚动到底加载更多

- IntersectionObserver 观察容器底部 ~600px 处的哨兵元素，进入视口时自动 fetch 下一批 24 张
- **无显式"加载更多"按钮**（违反"抢票零摩擦"原则）
- **无加载中 spinner**（违反克静纸面）
- 新数据到达后以 200ms 渐入接上，不破坏当前滚动位置

### 错误恢复

- **单图失败**：`<img onerror>` 切到 error 状态，单卡内显示 Folio Cream 占位 + 文案；不影响其他卡片
- **整批 fetch 失败**（5xx / 网络断）：整批静默不渲染，60s 后下次滚动到底再重试一次；**不弹错误 toast、不切容器到错误态**（符合"不打扰"原则）
- **重试次数**：单批最多重试 1 次；仍失败则容器底部静默显示与 end 态相同的「以上是…」句号（用户层面无感差异 —— 浏览者不需要知道后端在抖动）

### 跨组件信号（接入口）

瀑布流作为 Lightbox 的入口之一，**不主动维护任何全局选中态**，仅：

- 在点击卡片时向 Lightbox 发起 open 请求（携带 `photo.id` + 序列）
- 接收 Lightbox 的 `selected_photo_id` 信号 → 找到对应卡片切到 selected 视觉态
- Lightbox 关闭时 `selected_photo_id = null` → 所有卡回到 default

### Lightbox 关闭时的 scroll-into-view

- Lightbox 通过瀑布流入口打开时，关闭后由 Lightbox 调 `element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })` 到当前查看的卡片（让用户在滑了一阵照片之后还能回到出发位置，而不是迷失在瀑布流中间）—— 该行为定义在 shape-lightbox.md §7，本 brief 只承担「卡片需要有稳定的 DOM 锚点（`data-photo-id="${id}"`）供 Lightbox 调用」

## 8. Content Requirements

| 字段/元素 | 处理 |
|---|---|
| `seat_label` | 卡片上唯一可见的元数据；原文不翻译；单行省略 |
| `performance_date` | **不在卡片上显示**；仅 Lightbox 内 |
| `event_name` | **不在卡片上显示**；仅 Lightbox 内 |
| `description` | **不在卡片上显示**；仅 Lightbox 内 |
| 上传时间 | **不在卡片上显示**；仅 Lightbox metadata 展开 sheet 内（相对时间） |
| 图片 alt | zh: `${seat_label} 的座位视角` / ja: `${seat_label} の座席視点`，按 `[lang]` 切换 |
| 图片 src | R2 公共 URL（来自 `photo.image_key`）；客户端图片已是 WebP / 长边 ≤1920 / 去 EXIF（PRD R5） |
| 图片 srcset | `react-photo-album` 自动生成（PRD R5 已限制单图体积 ~500KB，无需额外多分辨率） |

### 双语文案表

| 场景 | zh | ja |
|---|---|---|
| 空状态主文案 | 这一层还没有粉丝分享视角。 | このエリアにはまだ視点投稿がありません。 |
| 空状态 CTA 链接 | 要做第一个吗？ | 最初の一枚を投稿しますか？ |
| 加载完毕尾态 | 以上是这一层目前的全部分享。 | ここまでがこのフロアの全投稿です。 |
| 单图错误 | 图片暂时无法显示 | 画像を表示できません |
| 卡片 aria-label | 查看 ${seat_label} 的座位视角 | ${seat_label} の座席視点を表示 |

## 9. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载：

`.agents/skills/impeccable/reference/`（若可访问）：

- `interaction-design.md` —— IntersectionObserver 触发节奏、卡片可点击区域设计、键盘 Tab 顺序
- `motion-design.md` —— hover brightness 250ms ease-out-quart、追加渐入 200ms、reduced-motion 降级
- `spatial-design.md` —— masonry layout 在 SSR + Astro Island 下的水合策略、CLS 防御（占位块按比例预留）

task-local：

- [`shape-venue-page.md`](shape-venue-page.md) §5 / §7 —— 容器在场馆页内的位置、宽度边界、跨组件信号位置
- [`shape-lightbox.md`](shape-lightbox.md) §7 "双入口语义" —— 瀑布流入口下 Lightbox 行为契约（左右翻页 / 关闭后 scroll-into-view）
- [`shape-seatmap-component.md`](shape-seatmap-component.md) §3.2 —— `selected` 态在标注点端的视觉规格（信号对端契约）
- [`frontend-libraries.md`](frontend-libraries.md) §C —— `react-photo-album` API、SSR 集成、`layout="masonry"` + `responsive` 配置示例

project-level：

- `DESIGN.md` §4 Elevation / §5 Do's and Don'ts —— Flat Folio Rule（无装饰 `box-shadow`）、Photo-Caption Rule（脚注不争重）
- `PRODUCT.md` 设计原则 1 / 5 —— 图片是主角（≥70% 视觉重量）、真实图像第一（元数据次之）
- `.trellis/spec/frontend/component-guidelines.md` —— Astro Island 边界、`client:visible` 水合
- `.trellis/spec/frontend/state-management.md` —— 跨组件信号实现（`selected_photo_id` 单向接收，瀑布流不维护全局态）

## 10. Decisions Locked (2026-05-24)

用户在 shape 阶段已确认的三处骨架决策：

1. **卡片 caption 形态** → **照片正下方一行小字，无装饰线**。caption 与照片之间 4px 呼吸，不加 Hairline Ash 底线 —— 更克制、更接近 Are.na 的纯图块气质，而非传统图鉴书的图录页装饰。
2. **桌面 hover 反馈** → **极轻微亮度 +2%，250ms ease-out**。翻图鉴书页式的反光隐喻 —— 可发现性够、噪音几乎为零、不抢戏。
3. **卡片间距** → **桌面 20px / 平板 16px / 移动 12px**。守 muji / cookpad 的留白节奏，密度合理，不滑向 Pinterest 紧凑也不滑向图鉴稀疏。

派生自上述决策与已有上下文的次级断言（已在 §5 §6 §7 明示，避免假性 open）：

- **卡片上只显示 `seat_label`，其他元数据全部下放到 Lightbox**（守 Photo-Caption Rule + 抢票 scan 效率）
- **照片不裁切**（保留用户上传原始纵横比 — "真实"高于"齐整"）
- **sharp 角，无 border-radius**（图鉴书页气质）
- **朱赤 accent 在瀑布流 surface 内完全不出现**（守 Restrained + 朱赤语义垄断）
- **占位/加载/error 一律不画 shimmer 动画**（与 Lightbox brief 一致 — shimmer 是 SaaS 模板语言）
- **加载更多无显式按钮、无 spinner、无"加载中"文字**（守抢票零摩擦）
- **整批失败 60s 后下次滚动到底再重试一次，不弹错误 toast**（不打扰原则）
- **selected 视觉态用色彩加深而非 box-shadow**（守 Flat Folio Rule）
- **空状态文案是缝隙时刻允许温度的位置；尾部句号则保持克制不卖萌**（PRODUCT.md 温度策略表 — 完成任务途中不打扰，停顿瞬间允许人情味）

## 11. Open Questions

无真正未决。implementation 阶段若需微调以下默认值（Lighthouse / a11y / 真机测试反馈）可视情况调整：

- **断点切换 3→4 列**：当前定 `≥1280px`，若 4 列在 1280-1400px 区间过窄触发横向挤压可上调到 1440px
- **底部哨兵触发距离**：当前 ~600px，若移动端慢网下用户感知到「等一下」可前置到 800-1000px
- **追加渐入时长**：当前 200ms，若用户反馈 "新内容突然出现" 可拉到 250-300ms
- **hover brightness 增量**：当前 +2%，若真机测试在低亮度屏幕上完全不可见可上调到 +3%（不允许超过 +5%，否则破坏"极轻微"语义）
- **selected brightness 减量**：当前 -5%，若与 hover 的 -2% 差异不够明显可拉到 -7%
- **每批照片数**：当前 24 张，按 Lighthouse / TTI 真机数据可在 18-30 间调整
- **空状态 CTA 链接的视觉**：当前为文本链接（Sumi Ink + underline on hover），实施时若发现可发现性不足可考虑切到墨黑 outline 小按钮（**绝不允许切到朱赤 tinted fill** — 朱赤的语义垄断守在标注点 selected 与上传按钮）

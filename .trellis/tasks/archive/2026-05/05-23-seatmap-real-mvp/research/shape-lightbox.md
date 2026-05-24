# Shape Brief — Lightbox（座位视角预览组件）

> 来源：`/impeccable shape Lightbox` 产出，用户已确认（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：从触发到关闭的整个 Lightbox 组件（含双入口语义、序列翻页、metadata 展开 sheet、墨色 overlay、所有状态、双语 aria/文案）。**不含**：坐席图标注点本体（已在 [`shape-seatmap-component.md`](shape-seatmap-component.md) 定义，选中态由本 Lightbox 通过跨组件信号驱动）；瀑布流图卡视觉（已在 [`shape-venue-page.md`](shape-venue-page.md) 定义）；上传 Sheet（独立组件，见 [`shape-upload-sheet.md`](shape-upload-sheet.md)）。

## 1. Feature Summary

Lightbox 是 SeatView 的「最后一公里」组件，承载产品的核心价值兑现：粉丝在抢票/选座的紧张 30 秒里点开任意标注点或瀑布流图片，浸入式地看到其他粉丝在这个座位拍下的真实视角。场馆树、搜索、坐席图、瀑布流四个组件全部是为了把用户精准送到这扇窗前。Lightbox 失败，整个产品价值就失败。

PRD 对应需求：R3.7（标注点入口）+ R3.9（瀑布流入口，与坐席图共用同一实例）。DESIGN.md 关键守则：The Photo-Caption Rule（照片是焦点、文字是脚注）+ Flat Folio Rule（深度仅来自 overlay，不来自 box-shadow）。

## 2. Primary User Action

「我要在 1-2 秒内判断**这个座位的视角能不能接受**」。其他一切（看 metadata、记录这场演出、对比其他位置）都是次级意图。Lightbox 的每个像素都要服务这一个判断动作。

## 3. Design Direction

- **Color strategy（per-surface override）**：主站默认 Restrained；Lightbox 是 SeatView 全站**唯一允许逼近 near-Drenched 的表面**。屏幕被墨色 overlay（OKLCH lightness ~10-14%，chroma 0.005-0.01 暖偏，绝不 `#000`）几乎完全吞没，照片是这片墨海里唯一的光源。**朱赤 accent 在 Lightbox 内完全不出现** —— Lightbox 是图鉴书页间的空白页，留给照片本身的色彩占有；当前位置 `n / N` 用 Hairline Ash 即可。
- **Theme**：Lightbox 永远是墨色 overlay（不论系统 light/dark），因为它的语义就是「图鉴书页之间的空白页」，不参与亮/暗主题切换。
- **Theme scene sentence**：「一位粉丝单手举着手机站在地铁车厢内（车厢灯偏冷、屏幕处于半俯视），抢票倒计时还剩 90 秒，Lightbox 一打开，整个屏幕的视觉重量瞬间塌缩到那张照片上，像翻开图鉴书页时的合页瞬间。深色 overlay 不是『深色模式』，是图鉴书页之间的空白页。」
- **Anchor references**（具体物件，非形容词）：
  - **Are.na 的图集预览**：克制墨底 + 照片悬浮 + metadata 完全不争重
  - **Apple Photos 的 Markup 沉浸预览**：metadata 半透明滑入、可下钻
  - **muji.com 商品大图**：米白与墨色的二元、平面、无阴影

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Scope

- **Fidelity**：Mid-fi
- **Breadth**：整个 Lightbox 组件，含双入口处理、所有状态、metadata 默认 + 展开两态、序列翻页（仅瀑布流入口）。不含坐席图、瀑布流卡、上传 Sheet
- **Interactivity**：交互模型 + 状态清单（不下到具体字号、间距、动画时序，那些到 craft / implement 再定）
- **Time intent**：一次性 shape，输出能直接交给 trellis-implement 落地

## 5. Layout Strategy

**沉浸式 overlay + 脚注**（用户已选定的拓扑）：

### Overlay
- 墨色 overlay 覆盖整屏，约 **90% 不透明度**。剩下 10% 让用户在屏幕边缘隐约感知坐席图/瀑布流还在背后，**保留空间连续感**。彻底切断会让用户失去「我从哪里来的」的方向感。
- 任何 box-shadow 装饰禁止；overlay 自身的色彩加深即是深度（Flat Folio Rule）。

### 照片
- `object-fit: contain` 居中。用户上传的视角图可能横、可能竖、可能极端比例，contain 保证完整呈现，不裁切。
- 最大占用 viewport：默认态下照片占据约 80% 高 + 全宽（左右各留 ~5% 让 hairline 翻页箭头有位置）。

### Metadata 默认条带
- 屏幕底部，**半透明压在照片上**（不挤占照片显示区，让照片的最大化呈现优先）。
- 单行 hairline 字号：`seat_label · 演出日期`（若日期空则只显示 seat_label）。
- 字体：Sans 主字号档（PRODUCT.md「文字是脚注」），不用 Serif（Serif 仅用于场馆名/章节性标题，详见 DESIGN.md Folio Title Rule）。

### Metadata 展开 sheet
- 点击条带后从底部滑起，约占 **30% viewport** 高度，展示完整字段（活动名 + 描述全文 + 上传时间）。
- 展开时照片自动缩到剩余 70% 空间内继续 contain；overlay 加深一档（lightness 降 ~3%）。
- Sheet 内允许独立滚动（描述很长时）。
- 再次点击条带 / 下拉 sheet / Esc → 收起。

### 序列翻页 affordance（仅瀑布流入口）
- 屏幕左右边缘的**极轻 hairline 箭头**，桌面 hover 时浮现（idle 时透明），移动端无视觉箭头、靠 swipe。
- **绝不出现常驻的实心箭头按钮** —— 那是票务站老旧排版的语言。
- 当前位置在底部一隅：极小字 `3 / 27`，tabular-nums，Hairline Ash 色。

### 关闭 affordance
- 右上角 ✕ 按钮，触达区 ≥44×44px，但视觉本体 hairline 字号、Hairline Ash 色。
- 日常用户优先路径：移动端 swipe-down、桌面 Esc / 点击 overlay 外区域。

## 6. Key States

| 状态 | 视觉描述 | 用户感受到 |
|---|---|---|
| **opening** | overlay 淡入 + 照片从触发点（坐席图标注点位置 / 瀑布流图卡位置）FLIP 缩放铺开 | 「这就是那个座位的视角」的连贯空间感 |
| **default** | 照片居中 + 底部一行 `seat_label · 日期` | 全副注意力在照片上 |
| **metadata expanded** | 底部 sheet 滑起；照片缩到剩余空间内 contain；overlay 加深一档 | metadata 是「下钻」而非「弹出」 |
| **photo zoom-in** | 用户双指/滚轮放大照片本身；metadata 条带保持在原位 | 能看到具体视野细节（远处舞台、前排人头、视线遮挡）这是 SeatView 的核心价值 |
| **loading** | 照片区域占位墨色块（**不是 spinner、不是 shimmer**），seat_label 立即可见（数据来自 D1） | 即使图片没加载完，先确认「在看的是哪个座位」 |
| **image error** | 米白底 + 一句温柔的双语提示；序列模式提供「换一张」 | 不冷漠、不报错弹窗、不归罪用户 |
| **sequence prev/next**（仅瀑布流入口） | 桌面：左右 hairline 箭头浮现；移动：swipe 触发翻页；底部一隅出现 `3 / 27` | 翻页 = 自然的图集浏览，不是模态嵌套 |
| **sequence boundary** | 翻到第一张往左 / 最后一张往右：照片轻微 ~5px 横向反馈后弹回原位 | 「我已经看完」的明确语义；不 wrap-around |
| **empty optional fields** | 选填字段为空时整行不显示，不留占位空行（不显示「活动名：—」这种） | 即使只有 seat_label，整体仍完整、不残缺 |
| **long description** | 描述超过 3 行折叠为「展开全文 / もっと読む」；展开后 sheet 内部滚动 | 长篇感想完整呈现，但不抢主视图 |
| **reduced motion** | FLIP 缩放降级为淡入；序列翻页降级为即时切换；sheet 滑起降级为淡入 | 严格尊重 `prefers-reduced-motion` |
| **closing** | 反向 FLIP 回到触发位置（标注点入口）或直接淡出（瀑布流入口） | 空间连续性收尾 |

## 7. Interaction Model

### 双入口语义（关键架构决策）

| 入口 | 用户意图 | Lightbox 行为 |
|---|---|---|
| 坐席图标注点（R3.7） | 「看**这个**座位」 | 从该标注点位置 FLIP 铺开；**无左右翻页**；关闭时反向 FLIP 回到标注点；该标注点保持 selected 高亮 ~1.5s 让用户记住「我刚看的是这个」 |
| 瀑布流图卡（R3.9） | 「浏览**这个场馆**的视角」 | 从该图卡位置 FLIP 铺开；**允许左右翻页**遍历同 sub-map 的所有照片；关闭时返回瀑布流并 `scroll-into-view` 到当前图卡 |

### 跨组件信号（继承自场馆页 brief）

- Lightbox 打开时（**无论从哪个入口**），向坐席图发射 `selected_photo_id` 信号 → 坐席图把对应标注点切到 `selected` 态（朱赤实心 + 墨黑细描边，见 `shape-seatmap-component.md` §3.2）。
- Lightbox 在序列模式翻页时，每翻一张就重新发射 `selected_photo_id` → 坐席图的 selected 标注点同步切换。
- Lightbox 关闭时发射 `selected_photo_id = null`，坐席图标注点回到 default 态（标注点入口路径下保留 1.5s 视觉余韵，瀑布流入口路径下也保留，因为标注点 selected 状态本身就是「我在看这张」的视觉书签，关闭后立即清掉过于突兀）。

### 手势矩阵

| 平台 | 关闭 | 翻页（仅序列） | metadata 展开 | 照片缩放 |
|---|---|---|---|---|
| 桌面 | `Esc` / 点击 overlay 外 / 右上角 ✕ | ← → 键 / 点击 hairline 箭头 | 点击底部条带 | 滚轮 / 双击放大 |
| 移动 | swipe-down / 右上角 ✕ | swipe-left / swipe-right | 点击底部条带 | 双指 pinch |

**照片缩放**：用户能在 Lightbox 内对照片本身做双指/滚轮缩放，看远处舞台、前排人头、视线遮挡这些视角细节。这是 SeatView 区别于票务站抽象坐席图的核心价值，**不允许省**。yet-another-react-lightbox 通过 `zoom` 插件提供（见 frontend-libraries.md），按需启用。

### Metadata 折叠 ↔ 展开

- 默认折叠：底部一行 `seat_label · 日期`，半透明条带，hairline 字号。
- 点击 → sheet 从底部滑起 ~30% viewport 高，显示活动名 + 描述全文 + 上传时间。
- 展开期间：照片不被「挤压消失」，而是缩到剩余 70% 空间内继续 contain；overlay 加深一档；不出现新的关闭按钮 —— 收起 sheet 走「再次点击条带 / 下拉 sheet / Esc」三条路径，与「关闭 Lightbox」明确区分。
- Esc 优先级：sheet 展开时 Esc 收 sheet；sheet 折叠时 Esc 关 Lightbox。

### 翻页连续性（仅序列模式）

- 翻页时照片 ~150ms ease-out-quart 横向滑动切换；metadata 同步更新。
- **不 wrap-around**：最后一张往右翻保持原位 + 极轻反馈（照片横向位移 ~5px 后弹回）。给用户「我已经看完」的明确语义，不假装无限循环。
- 翻页期间若新照片正在加载：保留当前 metadata 直到新 photo 数据进来，不闪烁。

## 8. Content Requirements

| 字段/元素 | 处理 |
|---|---|
| `seat_label`（必填） | 最显眼的 metadata；hairline 字号；`font-variant-numeric: tabular-nums` |
| 演出日期（选填） | ISO 存储；展示按 `[lang]` 本地化（zh: `2026年4月12日` / ja: `2026年4月12日`，注意都用「年月日」字面） |
| 活动名（选填） | 用户原文，**不翻译**（PRD R9.5） |
| 描述（选填） | 用户原文；超过 3 行折叠为「展开全文 / もっと読む」 |
| 上传时间 | 仅在 metadata 展开 sheet 内显示，相对时间（zh: `3 天前` / ja: `3日前`），不显示精确时间戳 |
| 关闭按钮 aria-label | zh: `关闭预览` / ja: `プレビューを閉じる` |
| 上一张按钮 aria-label | zh: `上一张` / ja: `前の写真` |
| 下一张按钮 aria-label | zh: `下一张` / ja: `次の写真` |
| metadata 条带 aria-label | zh: `展开座位详情` / ja: `座席詳細を開く` |
| 图片 alt | `${seat_label} ${演出日期 || ''} ${活动名 || ''} 的视角` 同等日文版本 |
| 加载占位 | 墨色色块（**不允许装饰性 shimmer**，与 Restrained 与 PRODUCT「不要 SaaS 模板」一致） |
| 图片加载失败文案 | zh: `这张照片暂时打不开` / ja: `この写真は今読み込めません`（不写「请」「敬请」、不写「亲」） |
| 序列入口下「换一张」按钮 | zh: `看下一张 →` / ja: `次の写真へ →` |
| 序列位置指示 | `3 / 27`，tabular-nums，Hairline Ash 色，底部一隅 |
| `展开全文` 文案 | zh: `展开全文` / ja: `もっと読む` |
| 收起 | zh: `收起` / ja: `閉じる` |

## 9. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载 `.agents/skills/impeccable/reference/` 下：

- `motion-design.md` —— overlay 淡入、FLIP 缩放、sheet 滑起、序列翻页的曲线（ease-out-quart）与时长上下界、reduced-motion 降级路径
- `interaction-design.md` —— sheet 展开/关闭手势状态机、swipe-down 阈值、Esc 优先级（sheet 折叠 vs Lightbox 关闭）
- `spatial-design.md` —— Lightbox 与坐席图/瀑布流的 FLIP 连续性、跨组件信号
- `color-and-contrast.md` —— overlay 不透明度（90%）与照片高光区的对比度平衡、Lightbox 内 Hairline Ash 在墨色背景上的可读性

task-local：

- [`shape-seatmap-component.md`](shape-seatmap-component.md) —— 跨组件信号契约的对端：`selected` 态视觉规格、selected 标注点保留 1.5s 的细节
- [`shape-venue-page.md`](shape-venue-page.md) —— 双入口（标注点 / 瀑布流卡）的触发位置、瀑布流 scroll-into-view 行为
- [`frontend-libraries.md`](frontend-libraries.md) §B —— yet-another-react-lightbox v3+ 的 zoom 插件、SSR 兼容性、`client:visible` 水合策略

## 10. Decisions Locked (2026-05-24)

用户在 shape 阶段已确认的三处骨架决策：

1. **Fidelity** → **Mid-fi**。布局/状态/交互模型钉清楚；具体字号、间距、动画时序留给 trellis-implement 阶段。
2. **内容拓扑** → **沉浸式 overlay + 脚注**。照片占主视觉，metadata 默认折叠为底部 hairline 条带、点击展开 sheet。不走「分区式底部独立条带」（挤照片）、不走「桌面双栏」（移动端体验割裂）。
3. **入口与导航** → **标注点单图 / 瀑布流序列**。标注点入口是「看这个座位」语义，无左右翻页；瀑布流入口是「浏览这个场馆视角」语义，允许左右翻页。两条路语义不同，复用同一 Lightbox 实例但模式不同。

派生自上述决策的次级断言（已在 §7 明示，避免假性 open）：

- 照片本身允许双指/滚轮缩放（核心产品价值，必选）
- 关闭路径：标注点入口反向 FLIP 回到标注点 + 保留 selected 1.5s；瀑布流入口淡出 + scroll-into-view 到原图卡
- 序列翻页不 wrap-around（语义上「我已经看完」）
- Lightbox 内朱赤 accent 完全不出现（守 Restrained，朱赤的语义垄断在「坐席图标注点 selected」与「上传按钮 tinted fill」两处）
- Metadata 展开 sheet 时 Esc 收 sheet 而非关 Lightbox

## 11. Open Questions

无真正未决。implementation 阶段若需微调以下默认值（Lighthouse 真机调参 / a11y 实测）可视情况调整：

- **overlay 不透明度**：90%（让边缘 10% 透出坐席图轮廓做空间连续性提示）；如真机测试发现边缘干扰过强可调到 92-94%
- **FLIP 缩放时长**：~250ms ease-out-quart；reduced-motion 下降级为 ~150ms 淡入
- **sheet 滑起时长**：~200ms ease-out-quart
- **序列翻页时长**：~150ms ease-out-quart 横向滑动
- **selected 标注点保留时间**：关闭后 1.5s（让用户视觉记忆有时间锚定）
- **描述折叠阈值**：超过 3 行折叠（按 sheet 内字号档计算）
- **照片缩放上限**：~4x（足够看清远处舞台细节，避免过度放大触发糊化）
- **swipe-down 关闭阈值**：纵向位移 ≥120px 且速度 ≥0.5px/ms（移动端，避免误触）
- **Lightbox 与照片预加载**：序列模式下预加载前后各 1 张（避免翻页时白屏），同时不预加载更远的避免浪费 R2 流量

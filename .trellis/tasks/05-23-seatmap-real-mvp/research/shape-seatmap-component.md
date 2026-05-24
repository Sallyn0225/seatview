# Shape Brief — 坐席图组件（Venue Detail 核心交互区）

> 来源：`/impeccable shape` 产出，用户已确认（2026-05-24）。trellis-implement 实施前必读。

## 1. Feature Summary

SeatView venue 详情页的核心交互组件。在场馆官方坐席图上叠加全部用户标注点，承担双指/滚轮缩放、平移、相邻点动态聚合、聚合点放大散开动画、单点击发射 Lightbox 信号。这是粉丝抢票紧张时刻的主要落点，必须零摩擦地完成"找到准备买的座位 → 看到那个座位的真实视角"这一步。

## 2. Primary User Action

在自己关心的座位区域上**一眼扫到一个朱赤标注点，点击它，立刻看到那个座位的真实视角照片**。

## 3. Design Direction

- **Color strategy**：Restrained（继承 DESIGN.md；坐席图本身已经是密集信息，没有任何理由 Committed）
- **Accent**：**朱赤**家族。OKLCH 参考 `lightness 50-55% / hue 25-30 / chroma 0.13-0.17`，刻意避开 SaaS-CTA 红的高饱和反射。具体值留待 implementation 时基于 light-mode 对比度测试敲定。
- **Theme**：Light-first。Dark 后续 `/impeccable adapt` 阶段补全。
- **Theme scene sentence**：「一名 25 岁的演唱会粉丝，在地铁通勤的最后两站，单手拿着手机站着，准备买 18:00 抢票窗口的票，正在 SeatView 上确认 1F E 列 23 号到底能不能看到主舞台 —— 屏幕上的纸面要呼吸顺畅、不刺眼，朱赤标注点必须一眼就能扫到。」→ 强制 light。
- **Anchor references**：
  1. **muji 商品页的呼吸感** —— 纸面留白、信息层次清晰、按钮褪到背景
  2. **Are.na 内容卡片** —— 资料图鉴感的密集信息排版、低饱和
  3. **Google Maps 室内地图** —— 仅借鉴平移/缩放/聚合的交互模型，不借鉴视觉

视觉直接探针（Phase 1.5）：harness 无 native image generation，跳过。

## 4. Scope

- **Fidelity**：production-ready
- **Breadth**：单组件（坐席图 + 标注点 + 聚合 + 动画 + 控件），**不含** sub-map tabs / 面包屑 / 上传按钮 / 瀑布流
- **Interactivity**：shipped-quality（全套状态机 + 移动端手势 + reduced-motion 降级 + 键盘可达）
- **Time intent**：polish 到能直接交给 trellis-implement 落地

## 5. Layout Strategy

坐席图 = surface 主体；标注点 = 唯一前景元素。优先级：

1. **画布最大化**：坐席图占组件 100% 可视面积；缩放控件 idle 5s 后降到 50% opacity，仍触达但视觉退后 —— 守 PRODUCT.md「chrome 在用户注视图片时褪到背景」。
2. **标注点的视觉差异化**（决定是否过 AI slop 测试的关键）：
   - **默认态**：`朱赤极淡描边 (1.5px, chroma 0.05) + 纸面奶色填充`，直径 8-10px。让标注点"沉在纸面里"。
   - **选中态**：`朱赤实心填充 + 墨黑细描边`，仅在 Lightbox 打开期间存在。
   - **hover 态（桌面）**：单点 ~1.2x 放大 + 朱赤淡 halo（不是阴影，是 chroma 0.03 的描边外扩）。
   - 这是唯一让"圆点 + 数字气泡"这条骨架不像 SaaS clusters 的差异化策略。
3. **聚合气泡**：直径 28-32px；`暖米白填充 + 朱赤极淡描边 + 墨黑文字`。数字字体 Noto Sans JP 700 + `font-variant-numeric: tabular-nums`。绝对不用 display font，不用渐变填充。
4. **缩放/平移控件**：右下角浮 `＋ / − / ⟲`（重置）三键；每个 ≥44px；纸面奶色 + 墨黑 icon。idle 5s 后 opacity 0.5；任何指针/触摸接触组件即恢复 1.0。
5. **缩放比例指示器**：左下角，小号 mono numeric（如 `1.4x`），仅缩放进行时可见。

## 6. Key States

| 子元素 | 状态 |
|---|---|
| 坐席图整体 | default / loading（低保真占位 + skeleton 标注点）/ error（加载失败）/ pinch-active / pan-active |
| 单标注点 | default / hover（桌面）/ focus（键盘）/ pressed / selected（Lightbox 打开期）/ fading-in（新上传 ~200ms ease-out-quart） |
| 聚合气泡 | default / hover / focus / pressed（触发放大）/ exploding（散开过渡中） |
| 缩放控件 | active / idle (50% opacity after 5s) / disabled（达 max/min 缩放） |
| reduced-motion 降级 | 聚合放大+散开 → 即时跳转；fade-in → 即时显示 |

**空状态**：sub_map 无任何上传时显示文案 + 邀请贡献的按钮入口（缝隙时刻允许温柔文案）。

## 7. Interaction Model

1. 进 `/<lang>/v/[venue-id]` → 默认显示唯一坐席图或第一个 sub-map（R3.2）。
2. 坐席图加载完成 → 标注点 fade-in（200ms，避免"突然多出 50 个点"的惊讶）。
3. **缩放**：桌面滚轮 / 移动端双指；**平移**：桌面拖 / 移动端单指滑。
4. **聚合阈值**：36px / scale，随缩放级别反相关动态变化（PRD R3.5 + Q6 留参数）。
5. **桌面 hover** 任一点 → 1.2x 放大 + halo；移动端无 hover 态。
6. **键盘 Tab**：标注点按屏幕坐标（左到右、上到下）顺序获得 focus；朱赤 2px focus ring（≥3:1 对比度）。
7. **点击聚合气泡**：
   - reduced-motion off：`zoomTo(x, y, currentScale × 2)` 触发 react-zoom-pan-pinch 的程序化缩放（ease-out-quart, 400ms）→ 缩放过程中阈值下降 → 气泡内子点自动散开。
   - reduced-motion on：即时跳转，无过渡。
8. **点击单标注点** → 发射 `onSeatSelect(photoId)` 给父组件（Lightbox 不在本 scope）。
9. **缩放达 max/min** → 对应控件按钮 disabled（视觉灰化 + `aria-disabled="true"`）。
10. **⟲ 重置** → `zoomTo` 回到 scale=1, x=center, y=center（同 400ms）。

## 8. Content Requirements

- **坐席图本体**：`venue.imageUrl` → R2 静态资源；MVP raster WebP（长边 ~1920px，懒加载）；备份 ~640px 占位用于 loading state（Q9 实施时 Lighthouse 验证）。
- **标注点数据**：D1 photos 表 `WHERE sub_map_id = ? AND deleted_at IS NULL`，含 `x_norm / y_norm`（0-1）和 `id`。
- **空状态文案**（中日双语）：
  - zh：「这个区域还没有粉丝分享视角。要做第一个吗？」
  - ja：「このエリアにはまだ視点投稿がありません。最初の一枚を投稿しますか？」
- **错误文案**（中日双语，task-中的中断，不温柔）：
  - zh：「坐席图加载失败。检查网络后刷新。」
  - ja：「座席図を読み込めませんでした。」
- **聚合气泡数字**：直接显示子点数；如 `2`、`5`、`12`、`47`。
- **alt 文本**：坐席图 = `venue.name + ' ' + sub_map.label`；单标注点 = SVG `role="button" aria-label="..."`，文案 `座位 <seat_label> 的视角` / `<seat_label>からの視点`。
- **图像资源**：坐席图（必需，外部 raster）；其他 icon（＋ / − / ⟲）= inline SVG 自绘，不引 icon 字体。

## 9. Recommended References

implementation 阶段（craft / sub-agent）应优先加载 `.claude/skills/impeccable/reference/` 下：

- `motion-design.md` —— 聚合放大 + 散开动画 + reduced-motion 降级
- `interaction-design.md` —— 标注点状态机、键盘可达、Tab 顺序
- `spatial-design.md` —— 坐席图与控件的空间关系、idle 退后行为
- `color-and-contrast.md` —— 朱赤 OKLCH 具体值的对比度验证
- `responsive-design.md` —— 移动端手势、控件触达区、断点策略

## 10. Open Questions

无真正未决。所有过去看起来开放的问题已断言默认：

- 聚合阈值：36px / scale 初值（PRD Q6 调参留实施）
- 朱赤 OKLCH 具体值：lightness 50-55 / hue 25-30 / chroma 0.13-0.17 范围内选
- 标注点 fade-in：200ms ease-out-quart
- 选中态视觉：朱赤实心填充 + 墨黑细描边
- 默认态视觉：朱赤极淡描边 + 纸面奶色填充

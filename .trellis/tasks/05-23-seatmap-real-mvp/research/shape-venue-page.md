# Shape Brief — 场馆页（Venue Detail Page）

> 来源：`/impeccable shape 场馆页` 产出，用户已确认（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：`/[lang]/v/[venue-id]` 整页 shell。覆盖 PRD R1（场馆树）+ R2（搜索）+ R3（场馆详情）+ R4（上传按钮位）+ R10（首屏/导航）。
> **坐席图组件本身已在 [`shape-seatmap-component.md`](shape-seatmap-component.md) 单独 shape；本 brief 只负责包裹与组合，不重复定义。**

## 1. Feature Summary

SeatView 最核心的浏览 + 贡献 surface。把场馆树、搜索、场馆标题、sub-map tabs、坐席图、上传按钮、瀑布流串成一条克静的图鉴书页 —— 用户能在抢票前 30 秒内单手完成「定位场馆 → 扫标注点 → 看真实视角 → 决定要不要也上传」的全流程。

## 2. Primary User Action

地铁通勤的最后 12 分钟，单手拿手机：**从场馆树/搜索找到目标场馆 → 在坐席图上扫到接近自己想买座位的朱赤标注点 → 点击 → 看到那个座位的真实视角照片**。其余动作（上传、滑瀑布流、换 sub-map）都是次级。

## 3. Design Direction

- **Color strategy**：Restrained（继承 DESIGN.md）。整页只允许两处朱赤：（a）坐席图标注点（已在组件 shape 定义），（b）「上传我的视角」按钮的 tinted fill（chroma ~0.04，≤10% 总面积，守 Restrained 阈值）。
- **Theme**：Light-first（继承坐席图组件）。Dark 在 `/impeccable adapt` 阶段补全。
- **Theme scene sentence**：「一名 25 岁的演唱会粉丝，17:48 下班地铁通勤、还有 12 分钟到 18:00 抢票窗口，单手拿 iPhone 13 站在车厢里 —— 已决定要去 K Arena 横滨，正在 L1/L3/L5/L7 几层间犹豫，需要快速翻几张照片确认哪一层视角更值得花钱。」→ Light 强制；移动端单手可达强制。
- **Anchor references**：
  - **muji 商品页** —— 纸面呼吸、信息分层、按钮褪到背景
  - **Are.na 内容卡片** —— 图鉴感、低饱和、密集排版
  - **新增：日本传统折页地图集（Folio atlas / 地図帳）** —— 场馆树是目录、场馆名是书页标题、sub-map tabs 是章节切换；这是 DESIGN.md「The Quiet Folio」精神的直接物化

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Scope

- **Fidelity**：production-ready
- **Breadth**：整个场馆页 shell（layout / 场馆树 / 顶部 chrome / 标题区 / sub-map tabs / 上传按钮入口 / 瀑布流容器）；**不含** 坐席图本体（已 shape）/ Lightbox / 上传 Sheet 内部表单 / 暂存区 / 后台
- **Interactivity**：shipped-quality（含三档响应式、键盘可达、移动端抽屉、空/错/加载/限频状态）
- **Time intent**：polish 到可直接交给 trellis-implement 落地

## 5. Layout Strategy

### 桌面端（≥1024px）

```
┌────────────────────────────────────────────────────────────────────┐
│ [SeatView]   [ 搜索框 ]                       [ja│zh]  [☀/🌙/⚙]   │  sticky chrome
├──────────┬─────────────────────────────────────────────────────────┤
│          │                                                         │
│ 北海道 ▸ │  日本 ／ 神奈川县           <- Sans 小字面包屑          │
│ 青森  ▸  │                                                         │
│ ...      │  Ｋアリーナ横浜             <- Serif Display            │
│ 東京都 ▾ │  K Arena Yokohama           <- Sans 罗马字副标题         │
│   花园   │                                                         │
│   ドーム │   L1 · L3 · L5 · L7         <- 扁平 tags                │
│ 神奈川 ▾ │   ─────                                                 │
│   ★K横  │                                                         │
│ 千葉  ▸  │  ┌─────────────────────────────────────────┐            │
│ ...      │  │         [坐席图组件]                    │            │
│          │  │  (见 shape-seatmap-component.md)        │            │
│          │  └─────────────────────────────────────────┘            │
│          │                                                         │
│          │       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │
│          │       ▓ ＋ 上传我的视角  ▓  <- 朱赤 tinted fill         │
│          │       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │
│          │                                                         │
│          │  ┌─────┬─────────┬───────┐                              │
│          │  │     │         │       │  <- 瀑布流 3-4 列            │
│          │  └─────┴─────────┴───────┘                              │
└──────────┴─────────────────────────────────────────────────────────┘
```

- **场馆树**：宽 ~280px，常驻左侧、**独立滚动**（不参与主区滚动）。背景用 Folio Cream，与主区 Warm Rice Paper 形成无阴影分层。
- **主区**：单列上下滚动 = `面包屑 → 场馆名（Serif） → sub-map tabs → 坐席图 → 上传按钮 → 瀑布流`。最大宽度约 900px 居中。
- **顶部 chrome**：sticky，背景用 Warm Rice Paper（不是 glassmorphism、不是 blur，而是纯色 + 一根 Hairline Ash 底边）。
- **不做 sticky 坐席图**：用户的注意力路径是「扫坐席图 → 看 Lightbox → 滚下来翻照片 → 决定上传」，坐席图离开视野时主任务多半已完成，不需跟随。

### 平板（768-1023px）

场馆树折叠为汉堡按钮触发的左侧抽屉；主区结构同桌面；瀑布流 2 列。

### 移动端（<1024px）

- 顶部 chrome 简化为 `[☰] [SeatView] [☀/🌙] [ja│zh]`
- 场馆树 = 左侧抽屉（覆盖 ~85% 屏宽，右边留一窄条让用户能 tap 关闭）
- 主区单列：`面包屑（更小） → 场馆名 Serif（缩到桌面 0.85x） → sub-map tabs（水平横滑，绝不换行）→ 坐席图 → 上传按钮 → 瀑布流 1 列`

## 6. Key States

| 区域 | 状态 |
|---|---|
| 场馆树 | default（有数据区划默认展开，无数据默认折叠）/ 单分组展开 / 单分组折叠 / 抽屉打开（移动） |
| 顶部搜索 | default / 输入中（实时显示候选）/ 无结果 / 候选选中 |
| 场馆面包屑 | default（始终显示当前场馆的「日本 / 神奈川县」） |
| 场馆标题区 | default / loading（场馆数据 fetch 中，骨架）/ 404 找不到（跳首页） |
| sub-map tabs | 单 sub-map（不渲染 tabs，直接显示坐席图）/ 多 sub-map（横排 tags + 当前下划线）/ 切换中（即时切换、无过渡动画） |
| 上传按钮 | default（朱赤 tinted fill）/ hover（描边色加深一档）/ pressed / disabled（IP 限频达上限） |
| 瀑布流 | default（上传时间倒序）/ loading（首批 12 张骨架）/ 空状态 / 加载更多中 / 全部加载完毕（句号收尾） |
| 整页 | default / 移动端抽屉打开 / 离线 / 错误 |

**空/错状态的温度策略**（DESIGN.md 已批准的「缝隙时刻」）：
- 瀑布流空：温柔（用户停顿）
- 场馆树搜索无果：温柔但务实（推荐去暂存区）
- 上传 disabled 限频：克制说明（不温柔，不卖萌）
- 404 找不到场馆：温柔（用户走错路了）

## 7. Interaction Model

### 入场
- `/` → Accept-Language 检测 → `/zh/` 或 `/ja/`
- 首次访问：显示首页说明页（R10.1）
- 后续访问：localStorage 读上次场馆 → 直接 `/[lang]/v/[venue-id]`
- 进入场馆页：默认显示唯一坐席图或第一个 sub-map（R3.2）

### 场馆切换
- 点击场馆树某场馆 → 整页 client-side 路由切换
- 桌面端场馆树折叠/展开状态在 session 内持久
- 移动端切换场馆后抽屉自动关闭

### sub-map tabs 切换
- 点击 tag → `?tab=<sub-map-id>` 同步 URL → 坐席图 + 瀑布流刷新
- 当前 tab：墨黑下划线 2px + 文字加重；非当前：Hairline Ash 灰
- 即时切换，不做过渡动画

### 上传按钮
- 点击 → 弹出上传 Sheet（**不是 modal**，遵守 PRD anti-modal）
- 移动端：Sheet 从底部升起，覆盖 ~90% viewport
- 桌面端：Sheet 从右侧滑入，宽 ~480px
- Sheet 内部表单流程在 PRD R4.3/R5/R11 定义，本 brief 不展开

### 瀑布流
- 默认上传时间倒序
- 点击照片 → 与坐席图标注点共用同一个 Lightbox 实例
- **跨组件信号**：Lightbox 打开时（无论入口），坐席图上对应标注点切到 selected 态（已在组件 shape 定义）
- 滚动到底加载更多（每批 24）；全部加载完显示一行小字句号：「以上是这一层目前的全部分享。」/「ここまでがこのフロアの全投稿です。」

### 键盘
- Tab 顺序：顶部 chrome → 场馆树（分组/场馆顺序）→ sub-map tabs → 坐席图（继承组件）→ 上传按钮 → 瀑布流照片
- `Esc`：抽屉打开时关闭抽屉
- `/`：聚焦搜索框（桌面 power user）

## 8. Content Requirements

### 字段（来自 PRD Data Model）
- 场馆名（双语，Noto Serif Display）：`venue.name_zh` / `venue.name_jp`
- 罗马字副标题（Noto Sans Body，小一档）：`venue.name_romaji`，可选显示
- 面包屑：`地域 / 都道府县`，按 `[lang]` 显示中/日行政区名
- sub-map 标签：`sub_map.label_zh` / `sub_map.label_jp`
- 瀑布流卡片元数据：`seat_label` + `performance_date`（选填）+ `event_name`（选填）+ 上传时间

### 双语文案

| 位置 | 中文 | 日本語 |
|---|---|---|
| 上传按钮 | ＋ 上传我的视角 | ＋ 自分の視点を投稿 |
| 上传按钮 disabled | 你今天已经上传 10 张了。明天再来。 | 本日の投稿数が上限に達しました。 |
| 瀑布流空 | 这一层还没有粉丝分享视角。要做第一个吗？ | このエリアにはまだ視点投稿がありません。最初の一枚を投稿しますか？ |
| 瀑布流尾 | 以上是这一层目前的全部分享。 | ここまでがこのフロアの全投稿です。 |
| 场馆树搜索无果 | 没找到这个场馆。可以在暂存区提交看看。 | 該当する会場が見つかりません。掲示板から投稿してみてください。 |
| 404 找不到场馆 | 这个场馆我们还没收录。要不去首页看看其他场馆？ | この会場はまだ収録されていません。トップから他の会場を探してみますか？ |

### 图像资源
- SeatView logo：未敲定（建议 type-only wordmark + 小幅墨黑印章感符号，留待 craft 决策）
- 场馆树分组图标：无需自定义，纯文字 + ▾/▸ unicode
- 上传按钮的 `＋`：inline SVG，1.5px stroke + 圆角，对应朱赤色

## 9. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载 `.claude/skills/impeccable/reference/` 下：

- `spatial-design.md` —— 三段式布局的空间关系与响应式断点
- `interaction-design.md` —— 抽屉、tabs 切换、上传按钮状态机
- `responsive-design.md` —— 桌面/平板/移动三档断点
- `color-and-contrast.md` —— 朱赤 tinted fill chroma 选值 + 上传按钮的对比度
- `typography.md` —— Serif Display 与 Sans Body 的字号比例
- `motion-design.md` —— 抽屉/Sheet 打开动画 + reduced-motion 降级
- 已存在的 task-local `shape-seatmap-component.md` —— 坐席图内部所有交互

## 10. Decisions Locked (2026-05-24)

用户在 shape 阶段已确认的三处关键决策：

1. **上传按钮视觉重量** → **Tinted fill 折中派**（朱赤极淡填充 chroma ~0.04 + 墨黑文字）。在 Restrained ≤10% accent 阈值内承担显著贡献入口；视觉如同图鉴里被标注过的章节书签。
2. **场馆名 + sub-map tabs 层级** → **完整图鉴书页式**（面包屑 + Serif Display 大标题 + 罗马字副标题 + 下方扁平 tags + 当前 tag 下划线）。守 DESIGN.md 的 Folio Title Rule。
3. **场馆树 MVP 默认展开** → **「有数据的区划」默认展开**，其余折叠。让首屏不空，符合「被人精心维护的小项目」气质；不读 localStorage 历史作为首次默认。

## 11. Open Questions

无真正未决。剩余细节已断言默认值：

- **场馆树宽度**：桌面 280px
- **主区最大宽度**：900px 居中
- **顶部 chrome 高度**：桌面 56px / 移动 48px
- **sub-map tabs 间隔**：每 tag 间距 24px，分隔符用居中的 `·`（Hairline Ash 色）
- **瀑布流加载策略**：首批 12 张 SSR，余下滚动加载 24 张/批
- **localStorage keys**：`seatview:last-venue` / `seatview:locale` / `seatview:theme` / `seatview:lang-tree-expanded`
- **第一次访问场馆页**（无 localStorage 历史）：场馆树仅展开有数据的区划，不读历史

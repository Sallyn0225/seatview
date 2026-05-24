# Shape Brief — 上传 Sheet（Contribution Sheet）

> 来源：`/impeccable shape 上传 Sheet` 产出，用户已确认（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：贡献者打开「＋上传我的视角」后的整个 Sheet 容器与 6 步流程（PRD R4 + R5 + R8.1 + R8.3-4 + R11）。**Sheet 在场馆页中的入口位置已在 [`shape-venue-page.md`](shape-venue-page.md) 锁定；本 brief 只负责 Sheet 内部。**

## 1. Feature Summary

SeatView 的贡献者（设备主要在桌面，少量移动端 Live 归来后即时分享）打开上传 Sheet，完成「在坐席图标点 → 选图 → 客户端压缩 → 填表 → 勾版权 → Turnstile + 提交」的累积式单页流程。唯一驱动力是利他感（PRODUCT.md「帮其他粉丝避免踩雷」），所以 Sheet 必须：每一步都肯定其贡献、不向用户索要解释、出错时不丢上下文。

## 2. Primary User Action

「我把刚去过的现场座位的视角图，无需注册地、五分钟内地、不被任何政策弹窗打扰地，分享到这本图鉴里」。所有其他动作（改位置、改图、看版权说明）都是次级。

## 3. Design Direction

- **Color strategy**：Restrained（继承）。Sheet 内仅允许两处朱赤：（a）当前步骤的左侧 ●（其他步骤为 Hairline Ash ○ / 已完成的 Sumi ✓）、（b）最终提交按钮的 tinted fill（同场馆页上传按钮规格 chroma ~0.04）。Sheet overlay 用墨色半透明（DESIGN.md「不是阴影，是一层墨水」）。
- **Theme**：Light-first（继承）。Dark 在 `/impeccable adapt` 阶段补全。
- **Theme scene sentence**：「一名 22:30 刚从 K Arena 横滨现场回到酒店的粉丝，瘫在床上、手机已经充上电、桌面端笔记本开着 SeatView，决定趁记忆还新鲜把自己的视角图分享出去，整个流程不希望超过五分钟、不希望被任何无关步骤打断。」→ Light-first 强制；桌面端为主要校准 surface。
- **Anchor references**：
  - **muji 商品下单流程** —— 单页累积、每步折叠为摘要、改回去成本极低
  - **Are.na 添加 block 流程** —— 内容（图片）是主角，元数据是脚注
  - **新增：日本传统手账/手写卡片** —— 已完成步骤像被写上的卡片栏目，墨色字迹 + 灰发线分隔；未到的步骤是空白卡格

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Scope

- **Fidelity**：production-ready
- **Breadth**：整个上传 Sheet 容器与 6 步内部内容、所有状态、所有错误。**不含** 场馆页上的入口按钮（已 shape）/ Lightbox / 客户端图片压缩底层实现（library 调用，但 UI 进度态在本 brief）
- **Interactivity**：shipped-quality（含三档响应式、键盘可达、移动端手势、reduced-motion 降级、IP 限频拦截）
- **Time intent**：polish 到可直接交给 trellis-implement 落地

## 5. Layout Strategy

### Sheet 形态（继承场馆页 brief）

- **桌面 ≥1024px**：右侧滑入抽屉，宽 480px，高 100vh
- **平板 768-1023px**：右侧滑入抽屉，宽 min(480px, 80vw)
- **移动 <768px**：底部升起 Sheet，高 90vh（顶部 10vh 留作墨色 overlay 与 ✕ 关闭把手）
- **背后**：墨色半透明 overlay（OKLCH lightness ~15% alpha 0.55），整页除 Sheet 外不可交互
- **边距**：Sheet 内部 padding 24px（桌面） / 20px（移动）；顶部 chrome（标题 + ✕）固定 sticky；底部「提交」按钮固定 sticky（如内容溢出则中间区域独立滚动）

### 累积式单页骨架

```
┌─ ＋ 上传我的视角 ──────────────────────── ✕ ─┐
│ <- 标题区 sticky，下方一根 Hairline Ash 分隔  │
├──────────────────────────────────────────────┤
│ ✓ 1. 座位位置                                │  <- Sumi ✓，已完成摘要
│   L3 · 27% / 64%                       改   │     右侧「改」是 Sans 小字
│ ─────                                        │     Hairline Ash 分隔线
│ ✓ 2. 视角照片                                │
│   [40×40px 缩略图] photo.webp · 480KB  改   │
│ ─────                                        │
│ ● 3. 元数据                                  │  <- 朱赤 ● 当前步骤
│   座位号 *                                   │
│   ┌──────────────────────────────┐           │
│   │  1F E-23                     │           │
│   └──────────────────────────────┘           │
│   演出日期（选填）  □ YYYY-MM-DD             │
│   活动名（选填）    [_______________]        │
│   简短描述（选填）  [_______________]        │
│                              下一步 →        │
│ ─────                                        │
│ ○ 4. 版权同意                                │  <- Hairline Ash ○ 未到
│ ○ 5. 验证与提交                              │
└──────────────────────────────────────────────┘
```

### 各步骤展开形态

**1. 座位位置（展开时占 ~360px 高）**：Sheet 内嵌纯净坐席图（无任何已上传标注点）；顶部一句 helper「点击你坐过的位置 / 自分が座った位置をタップ」；右下角浮 ⊕ ⊖ ⟲ 三键（同主坐席图组件，缩到 36px）；坐席图下方一行「撤销 / 重新标 / 确认位置 →」。完成后折叠为「`<sub_map.label>` · `xx% / yy%` 改」摘要。

**2. 视角照片（展开时占 ~280px 高）**：纸面奶色虚线框 dropzone + 「点击选择 / 拖入照片」 + 一行小字「长边将压到 1920px，转 WebP，去 EXIF」。选图后立刻显示 client-side 压缩进度 `压缩中... 72%`（细线进度条 + tabular-nums），压缩完成显示「`photo.webp · 480KB` 改」摘要 + 40×40 缩略图。

**3. 元数据（展开时占 ~280px 高）**：座位号 input 自动 focus；演出日期用 shadcn Date Picker（PRD R4.3.6）；活动名 + 描述用 textarea（描述 max 200 字符，右下角字数指示）。**所有选填字段不显示 `(选填)` 重复词，placeholder 留空，label 自身写「演出日期 任意 / 公演日 任意」。** 底部「下一步 →」按钮。

**4. 版权同意（展开时占 ~120px 高）**：DESIGN.md「信任靠流程透明」的核心兑现位。三行文案 + 一个 checkbox，没有任何花活：
   ```
   ☐  我确认拥有此照片的版权，并同意以
      CC BY-NC 4.0 [↗] 协议分享给本站及其他用户参考。
      我已遮蔽他人面部 / 不当个人信息。
   ```
   勾选后展开下一步。

**5. 验证与提交（展开时占 ~180px 高）**：
   - Cloudflare Turnstile widget（managed mode，自动渲染）
   - 下方「为什么要做这个验证？防止机器人滥用上传通道。」一行小字
   - 下方「为什么有上传次数限制？每个 IP 每天 10 张，避免单人刷屏。」一行小字
   - 最底「＋ 上传 / ＋ 投稿する」朱赤 tinted fill 提交按钮（继承场馆页规格）
   - 提交后按钮变为 `上传中... <retry-state>` + 细线进度条；ADR-12 重试时显示「重试中... (2/3)」

### 「改」回到任意步骤

点「改」→ 该步骤展开 + 所有之后的已完成步骤折叠回未到态（○ Hairline Ash），数据保留但需要用户重新确认。**不弹任何确认 modal**。

### 上传成功

整个 Sheet 内容**就地替换**为一个克制的成功页（不是 toast、不是新 modal）：

```
┌──────────────────────── ✕ ─┐
│                            │
│      [一枚墨色折页书签符号]  │  <- 自绘 SVG，~40px
│                            │
│   你的视角已添加到这本图鉴   │  <- Serif Display 小一档
│   その視点が図鑑に綴じられました │
│                            │
│   现在它出现在这一层的瀑布流  │  <- Sans body
│   最前面，其他粉丝就能看到。  │
│                            │
│   [再传一张 / もう一枚]      │
│   [回到场馆 / 会場へ戻る]    │
│                            │
└────────────────────────────┘
```

这是 DESIGN.md 明确允许的「缝隙时刻」：贡献者刚做了利他动作，是 SeatView 整套 UI 里唯一允许出现 Serif Display + 自绘符号的成功反馈。但仍守纪律 —— 没有粒子动画、没有彩色光晕、没有「太棒了！」式感叹。

## 6. Key States

| 区域 | 状态 |
|---|---|
| Sheet 容器 | 关闭 / 打开中（slide-in 250ms ease-out-quart）/ 已打开 / 关闭中 / **未保存关闭尝试** |
| 步骤 1 标注坐席图 | default / loading 坐席图 / 加载失败 / 已标点（hover 显示「拖动调整」）/ 正在拖动 / 已确认折叠 |
| 步骤 2 选图 | default 空 dropzone / dragenter 高亮 / 选中处理中（压缩进度 0-100%）/ 处理完成折叠 / 处理失败（图过大 / 格式不支持）/ 移动端摄像头直拍 |
| 步骤 3 元数据 | default / 座位号 invalid（空提交）/ 字数超限 / 已确认折叠 |
| 步骤 4 版权 | 未勾 / 已勾 |
| 步骤 5 验证 + 提交 | Turnstile loading / Turnstile failed / Turnstile passed / 提交中 / 重试中 (1/3, 2/3) / 网络失败 / R2 上传失败 / Worker 写库失败 / **限频拦截**（10 张/天 或 30s 冷却内）/ 成功 |
| 整体 | reduced-motion 降级（slide-in 变即时显示，progress 仍正常）/ 离线检测（提交时网络断开）/ Sheet 高度溢出滚动 |

### 「未保存关闭尝试」的处理（断言）

用户点 ✕ 或 Esc 关闭 Sheet 时：
- 如果当前 Step 1 都没完成 → 直接关闭，不挽留
- 如果 Step 1+ 任一已完成 → 在 Sheet 内部底部弹一行 inline 确认带（**不是 modal**）：「关闭会丢失你刚标好的位置和照片。/ 入力内容は破棄されます。」+ 「真的关闭 / 破棄」「继续填写 / 続ける」两个按钮。3 秒不操作自动消失退回正常关闭按钮可用态。

### 「缝隙时刻」温度策略（DESIGN.md 已批准）

- 步骤 1 坐席图加载失败：克制（任务中断）
- 步骤 2 图片处理失败：克制 + 一句建议（「这张图过大了，挑一张小于 10MB 的试试」）
- 限频拦截：克制说明（不卖萌 —— PRODUCT.md 已批准这一条）
- 上传成功：温柔（用户停顿 —— 唯一允许 Serif Display + 自绘符号的位置）
- 离线检测：克制 + 建议「等会儿重试，我们帮你保留这几步的数据」

## 7. Interaction Model

### 入场

- 父组件（场馆页）调用 `<UploadSheet open={true} venue={...} subMap={...} />`
- Sheet 滑入 250ms ease-out-quart；overlay fade-in 同步
- 首屏自动展开 Step 1 + auto-focus 坐席图
- Tab 键顺序：✕ 关闭 → 当前步骤所有交互元素 → 后续步骤的「改」按钮（如有）

### 步骤推进

- **不强制顺序，但建议顺序展开**：用户完成 Step N 点「下一步」自动展开 Step N+1 + 平滑滚动到展开位置（150ms）。
- **用户跳跃式编辑**：点已完成步骤的「改」按钮 → 该步骤展开 + 之后步骤回到 ○ 未到态。
- **不显示顶部进度条**：累积式单页本身就是进度感知，加进度条是冗余。

### Step 1 标注交互

- 单击坐席图任意位置 → 朱赤标注点出现（同主坐席图组件的 selected 态视觉）
- 拖动标注点 → 实时更新（移动端长按 200ms 进入拖动模式）
- 「撤销」→ 移除标注点回到 default
- 「确认位置 →」disabled 直到标注点存在；点击后该步骤折叠为摘要 + 展开 Step 2
- 移动端双指缩放/平移坐席图正常（继承主坐席图组件手势）；reduced-motion 不影响

### Step 2 图片处理

- 桌面：点 dropzone 触发文件选择 / 拖拽文件落入；移动：点 dropzone 唤起本地选图（也支持直拍）
- 选中文件后立刻 client-side 处理（browser-image-compression Web Worker）；进度条实时更新
- **失败时**：dropzone 红边 + 一行 inline 错误 + 「换一张 / 別のファイル」按钮，原 dropzone 状态保留
- 完成后摘要里的「改」点击 → 重置回 dropzone

### Step 3 表单

- 座位号必填校验在「下一步」点击时执行（不是 onBlur，避免用户刚输入半截就报错）
- 演出日期 Date Picker 用 shadcn Calendar（默认无选中，今天高亮）
- 「下一步」disabled 直到座位号有内容；其他字段为空允许通过

### Step 4 版权

- 勾选 → 自动展开 Step 5（不需要额外「下一步」点击）
- 取消勾选 → Step 5 立刻折叠回 ○ + 提交按钮 disabled

### Step 5 提交

- Turnstile widget 在 Step 5 展开时才渲染（避免过早消耗 token）
- 「＋ 上传」按钮 enabled 条件：Turnstile token 通过 + 版权已勾 + Step 1/2/3 都已完成
- 提交后按钮文字切换 `上传中...` + 进度条
- ADR-12 重试期间 token 复用；3 次都失败显示 inline 错误「网络似乎不稳，再试一次？」+ 「重试」按钮
- 成功后整个 Sheet 切换到成功页（5.1 节描述）

### 键盘

- `Esc`：触发 ✕ 关闭逻辑（含「未保存关闭尝试」分支）
- `Tab` / `Shift+Tab`：按视觉顺序遍历
- `Enter` on 座位号 input：等同点「下一步」
- Sheet 打开期间，焦点 trap 在 Sheet 内部（不允许 Tab 出到背景页）

### 移动端手势

- 顶部把手区域（Sheet 上方 ~40px 空隙）支持下拉关闭手势（与 ✕ 走同一关闭逻辑）
- Sheet 内部所有滚动正常，不与父页面滚动冲突

## 8. Content Requirements

### 字段（来自 PRD Data Model）

发起上传时父组件应注入：`venue: Venue`、`subMap: SubMap`。Sheet 内部产出 `{ x_norm, y_norm, image_blob, seat_label, performance_date?, event_name?, description? }`。

### 双语文案表

| 位置 | 中文 | 日本語 |
|---|---|---|
| Sheet 标题 | ＋ 上传我的视角 | ＋ 自分の視点を投稿 |
| Step 1 标题 | 1. 座位位置 | 1. 座席の位置 |
| Step 1 helper | 点击你坐过的位置 | 自分が座った位置をタップ |
| Step 1 按钮 | 撤销 / 重新标 / 确认位置 → | 取り消す / やり直す / 位置を確定 → |
| Step 2 标题 | 2. 视角照片 | 2. 視点写真 |
| Step 2 dropzone | 点击选择或拖入照片 | クリックまたはドラッグで写真を選ぶ |
| Step 2 处理说明 | 长边将压到 1920px，转 WebP，去 EXIF | 長辺を 1920px に圧縮、WebP に変換、EXIF を削除 |
| Step 2 进度 | 压缩中... 72% | 圧縮中... 72% |
| Step 2 失败 | 这张图过大了，挑一张小于 10MB 的试试 | このファイルは大きすぎます。10MB 以下のものを選んでください |
| Step 3 标题 | 3. 元数据 | 3. 詳細 |
| Step 3 字段 | 座位号 / 演出日期 任意 / 活动名 任意 / 描述 任意 | 座席番号 / 公演日 任意 / イベント名 任意 / 説明 任意 |
| Step 3 座位号 placeholder | 例: 1F E-23 | 例: 1F E-23 |
| Step 3 座位号未填 | 座位号是必填的。 | 座席番号を入力してください。 |
| Step 4 标题 | 4. 版权同意 | 4. 著作権の同意 |
| Step 4 文案 | 我确认拥有此照片的版权，并同意以 CC BY-NC 4.0 协议分享给本站及其他用户参考。我已遮蔽他人面部 / 不当个人信息。 | この写真の著作権を保有し、CC BY-NC 4.0 ライセンスでサイトおよび他のユーザーと共有することに同意します。他人の顔・不適切な個人情報は隠してあります。 |
| Step 5 标题 | 5. 验证与提交 | 5. 確認と投稿 |
| Step 5 Turnstile 说明 | 为什么要做这个验证？防止机器人滥用上传通道。 | 認証が必要な理由：bot による不正投稿を防ぐためです。 |
| Step 5 限频说明 | 为什么有上传次数限制？每个 IP 每天 10 张，避免单人刷屏。 | 投稿数の制限について：同一 IP からは 1 日 10 枚まで。 |
| Step 5 提交 | ＋ 上传 | ＋ 投稿する |
| 上传中 | 上传中... | 投稿中... |
| 重试中 | 重试中... (2/3) | 再試行中... (2/3) |
| 失败 inline | 网络似乎不稳，再试一次？ | 通信が不安定なようです。もう一度試しますか？ |
| 限频拦截（10/天） | 你今天已经上传 10 张了。明天再来。 | 本日の投稿数が上限に達しました。 |
| 限频拦截（30s 冷却） | 刚上传过一张，等几秒再上传下一张。 | 投稿直後です。数秒お待ちください。 |
| 关闭确认 | 关闭会丢失你刚标好的位置和照片。 | 入力内容は破棄されます。 |
| 关闭确认按钮 | 真的关闭 / 继续填写 | 破棄 / 続ける |
| 成功页主文案 | 你的视角已添加到这本图鉴 | その視点が図鑑に綴じられました |
| 成功页 sub 文案 | 现在它出现在这一层的瀑布流最前面，其他粉丝就能看到。 | このフロアの一覧の最上位に表示され、他のファンにも見えます。 |
| 成功页按钮 | 再传一张 / 回到场馆 | もう一枚 / 会場へ戻る |

### 图像 / 视觉资源

- **Step 1 坐席图**：复用 `subMap.imageUrl`；与场馆页主坐席图共用同一份 raster，可走浏览器缓存
- **Step 2 缩略图**：客户端处理完毕的 webp blob → object URL，40×40 cover
- **成功页折页书签符号**：自绘 inline SVG，墨色单色，~40px 高，做成「折页带书签」的小印章样式（不引图标库）
- **CC BY-NC 4.0 [↗]**：外链小箭头用 unicode `↗` 即可，墨色

## 9. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载 `.claude/skills/impeccable/reference/` 下：

- `interaction-design.md` —— 多步表单的累积式单页交互、状态机、focus 管理
- `motion-design.md` —— Sheet slide-in / step 展开 / reduced-motion 降级
- `responsive-design.md` —— 桌面右侧 480px / 移动底部 90vh 形态、触达区
- `color-and-contrast.md` —— 朱赤 tinted fill chroma 值、step 标志色（Sumi ✓ / 朱赤 ● / Hairline ○）对比度
- `spatial-design.md` —— Sheet 内部 padding、step 间分隔线、sticky chrome
- `typography.md` —— 仅在成功页用 Serif 的 exception 处理
- 已存在的 task-local `shape-seatmap-component.md` —— Step 1 标注坐席图复用其手势 + 控件

## 10. Decisions Locked (2026-05-24)

用户在 shape 阶段已确认的三处骨架决策：

1. **6 步流程的容器** → **累积式单页**。完成的步骤折叠为一行摘要（含「改」按钮，仍可回去修改）；Sheet 内部上下滚动；不做顶部进度条；不做 Wizard prev/next；不做单一长表单。
2. **Step 1 标注坐席图位置** → **Sheet 内嵌**。桌面 480px Sheet 内宽度内允许缩放/平移；移动 90vh Sheet 上半屏占坐席图；不做全屏接管；不做主页面坐席图改模式。
3. **错误呈现位置** → **就地 inline + 重试**。每一步的失败信息出现在该步骤内部对应位置（Turnstile 在 Turnstile 下，上传错误在按钮上方，限频在按钮上方）；不做顶部 toast；不做 Sheet 切换到错误态全屏。

## 11. Open Questions

无真正未决。剩余细节已断言默认值（implementation 阶段若有 Lighthouse / 真机调参可微调）：

- **Sheet 宽度**：桌面 480px、平板 min(480, 80vw)、移动 90vh
- **slide-in 动画**：250ms ease-out-quart；reduced-motion 下降级为即时显示
- **step 展开过渡**：150ms ease-out-quart 高度变化（CSS grid-template-rows 0fr → 1fr 技巧避免 height transition 抖动）
- **step 之间分隔线**：1px Hairline Ash
- **当前 step 标志**：朱赤 ● 8px；已完成 Sumi ✓ 12px；未到 Hairline ○ 8px
- **「改」按钮**：Sans body 小一档（13px），Hairline Ash 色（默认），hover 时变 Sumi
- **关闭确认带**：Sheet 内部底部 inline，3 秒无操作自动消失，不弹 modal
- **Turnstile 渲染时机**：Step 5 展开时才渲染（避免过早消耗 token）
- **关闭快捷键**：`Esc` 走 ✕ 同一逻辑
- **成功页停留时间**：无自动关闭；用户必须主动点「再传一张」或「回到场馆」
- **离线检测**：仅在 Step 5 提交时检测（`navigator.onLine` + fetch 失败双重判断）；其他步骤不阻塞

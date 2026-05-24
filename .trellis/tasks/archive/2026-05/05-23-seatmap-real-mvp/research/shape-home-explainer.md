# Shape Brief — 首页说明页（Home Explainer）

> 来源：`/impeccable shape 首页说明页` 产出，用户已确认（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：`/[lang]/` 路由的卷首页。覆盖 PRD R10.1（首次访问说明页）+ R11.3（footer 协议链接）+ R13.2（footer 贡献新场馆入口）。
> **场馆页 shell 与坐席图组件本身已分别 shape 在 [`shape-venue-page.md`](shape-venue-page.md) / [`shape-seatmap-component.md`](shape-seatmap-component.md)；本 brief 不重复定义场馆树 / 坐席图 / 上传 Sheet。**

## 1. Feature Summary

SeatView 的"卷首页"。第一次访问的粉丝从这里读到：(a) 这个站是干什么的，(b) 怎么用它（三步），(c) 1-2 个可以立刻打开看的样板场馆，(d) 上传时要遵守的克制底线，(e) 关于/贡献/法律链接。后续访问通过 localStorage 跳过本页直接回到上次的场馆。这是 DESIGN.md 明确允许"缝隙时刻人情味"的少数 surface 之一，也是 Folio Title Rule 唯一额外允许 Serif Display 出场的位置。

## 2. Primary User Action

第一次打开 SeatView 的粉丝，在 8-12 秒内理解 **"哦，是给我看抢票前看不到的真实座位视角的"**，然后点 hero CTA 进入图鉴 —— 或者直接点击下方两个示例场馆中的任一进入查看。其余动作（读完使用流程三步、看完上传规则、点 footer 链接）都是次级。

## 3. Design Direction

- **Color strategy**：**Restrained**，且**比场馆页更严格** —— 整张首页**朱赤完全不出现**。理由：本页是卷首页而非功能页，没有"标注点"和"上传按钮"这两个朱赤合法位置；如果在首页 CTA 上用朱赤 tinted fill，会把朱赤变成"装饰色"而非"功能信号色"，反过来稀释场馆页里朱赤的语义重量。整页色彩只用 Sumi Ink / Warm Rice Paper / Folio Cream / Hairline Ash 四档中性色。
- **Theme**：Light-first（继承）。Dark 在 `/impeccable adapt` 阶段补全。
- **Theme scene sentence**：「一名 23 岁的演唱会粉丝，在某个普通的午后，被朋友 LINE 群里随口提的一句"听说有个网站能看演唱会座位视角"勾起好奇，第一次在 iPad 上打开 SeatView，还不知道这是什么东西、能不能信任、要不要花时间看；屏幕里要出现的第一印象就要让他立刻判断"这是个被人精心维护的小项目，值得我花 10 秒读下去"。」→ Light 强制；首屏密度要低、呼吸要顺；说服路径要短。
- **Anchor references**：
  - **muji.com 首页** —— 纸面卷首页范式：Serif 大字 + Sans 副文 + 几乎没有装饰
  - **cinra.net 文化版面** —— 中等留白、严肃克制、信息分层
  - **Are.na "About" 页** —— 工具型站点的卷首页表达：不卖弄、不营销、有明确的"用了它能干什么"

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Decisions Locked (2026-05-24)

用户在 shape 阶段已确认的三处关键决策：

1. **整页气质** → **中度图鉴卷首序**（hero + 三段下滑：使用流程三步 / 示例场馆链接 / 上传规则简版 / footer）。不做单屏极克制版（PRD R10.1 内容会被压缩）；不做长滚叙事页（与"抢票零摩擦"反指标冲突）。
2. **Hero 装饰** → **严守极克制，不加任何朱赤印章 / 章节序号**。Hero 区只有 Serif 大字 + Sans 副文 + 一条 Hairline Ash 分隔线。这是整站对 The Quiet Folio 最纯粹的解读。
3. **示例场馆呈现** → **极简文字链接**（每个一行：场馆名 Serif 中号 + 一句话注释 Sans 小字 + 进入箭头）。零图片资源依赖，加载快，与"图鉴目录"感一致。不做缩略卡（视觉重量与卷首页气质有微张力，且 MVP 真实照片资源尚少）。

派生决策（由上述三条强制推出）：

- **Hero CTA 按钮形态** → **墨黑 outline 描边按钮**（纸面奶色填充 + 墨黑文字 + 1.5px 墨黑描边 + 右侧 `→` 箭头）。**不**用朱赤 tinted fill —— 朱赤在 SeatView 整站只承担两个语义：标注点 / 上传按钮，首页 CTA 是"导航行为"不是"贡献行为"，不消耗朱赤。
- **使用流程三步图标** → **不画图标**。极简数字 ①②③ + Sans 加重大字步骤名 + Sans 小字一句注释。守住卷首页的最低视觉噪音。
- **CTA 文案** → 「打开图鉴」/「図鑑をひらく」。保留卷首气质又平实不矫情，不滑向"开始体验吧 ✨"式的 SaaS 套话。

## 5. Scope

- **Fidelity**：production-ready
- **Breadth**：整张 `/[lang]/` 卷首页（hero / 使用流程 / 示例场馆 / 上传规则 / footer），**不含** 场馆树 / 坐席图 / 上传 Sheet 内表单 / 暂存区 / 后台
- **Interactivity**：shipped-quality（含三档响应式、键盘可达、深浅色继承、reduced-motion）
- **Time intent**：polish 到可直接交给 trellis-implement 落地

## 6. Layout Strategy

### 桌面端（≥1024px）

```
┌───────────────────────────────────────────────────────────────┐
│  [SeatView]                              [ja│zh]  [☀/🌙/⚙]    │  sticky chrome
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                                                               │
│                                                               │
│              SeatView                                         │  ← Serif Display 96px
│              リアル座席ビュー                                     │  ← Serif Display 36px 副标题
│                                                               │
│              ─────                                            │  ← Hairline Ash 80px 分隔线
│                                                               │
│              抢票前的最后 30 秒，                                │  ← Sans 20px 一句话定位（2 行排版）
│              先看一眼那个座位真正能看到的。                        │
│                                                               │
│              ┌────────────────────┐                           │
│              │  打开图鉴   →      │                           │  ← 墨黑 outline CTA
│              └────────────────────┘                           │
│                                                               │
│                                                               │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  ← 整屏 hero 边界（用户滚下来）
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   怎么用                              ＼/  使い方                │  ← Serif 28px 章节标题（中日并排）
│                                                               │
│   ①  找场馆        ②  看视角        ③  上传                    │  ← Sans 700 18px 三步骨架
│       从左侧场馆       点击坐席图上       拍下你自己的           │  ← Sans 14px 一句注释
│       树或搜索框        的标注点，看      座位视角，照同样       │
│       挑场馆。          那个座位实拍       的方式标在坐席         │
│                         的现场。          图上分享。            │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   推荐先看                            ＼/  おすすめ              │  ← Serif 28px 章节标题
│                                                               │
│   Kアリーナ横浜                                    →            │  ← Serif 22px 场馆名 + 右箭头
│   K Arena Yokohama                                            │  ← Sans 14px 罗马字副标题
│   多层环绕，4 个 sub-map 共 100+ 张视角                          │  ← Sans 14px 注释
│                                                               │
│   ─────                                                       │  ← Hairline Ash 行间分隔
│                                                               │
│   東京ガーデンシアター                              →            │
│   东京花园剧场                                                 │
│   8000 席，最佳观演视角的争议地                                  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   关于上传                            ＼/  投稿について          │  ← Serif 28px 章节标题
│                                                               │
│   · 必须是你本人拍摄的照片。                                     │  ← Sans 16px 三条简约 bullet
│   · 请遮蔽他人面部和可识别个人信息。                              │
│   · 内容以 CC BY-NC 4.0 协议分享 ↗                              │  ← 协议名 underline 链接
│                                                               │
│   一天每人最多上传 10 张。这样能让所有人看到的内容质量保持稳定。     │  ← Sans 14px 灰发线色注脚
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   想贡献新场馆？通过 GitHub 提交 ↗                               │  ← Sans 14px 一行 link
│                                                               │
│   GitHub  ·  关于  ·  隐私政策  ·  服务条款                     │  ← Sans 12px footer
│                                                               │
│   © SeatView · リアル座席ビュー                                  │  ← Sans 12px 灰发线色版权行
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

- **主区最大宽度**：680px 居中（比场馆页 900px 窄，因为本页内容是阅读流而非图像流，需要更短行宽守 65-75ch）。
- **整页节奏**：hero 自带完整一屏（min-height: 100svh - chrome）让卷首气质完整；其后四个章节各自 ~280-360px 高度，章节间用 ~64px 垂直留白拉开呼吸。
- **章节标题排版**：中日并排显示（用 `＼/` 装饰性斜线分隔），不是"翻译"关系，是"两个等价标题并立" —— 守 PRODUCT.md 的"双语等价"。

### 平板（768-1023px）

主区最大宽度 568px 居中；hero Serif 缩到 72px / 32px；三步流程改为单列纵排（每步占一行：`① 找场馆 — 从左侧场馆树挑`）；其余结构同桌面。

### 移动端（<768px）

- 顶部 chrome 简化为 `[SeatView] [ja│zh] [☀/🌙]`（三个元素挤在 48px 高内）
- 主区左右 padding 24px；最大宽度 100%
- Hero Serif 缩到 48px / 22px；分隔线缩到 48px；一句话定位 17px / 行高 1.5
- CTA 占全宽（max-width 320px 居中）
- 三步流程纵排（每步占一段：① 大字 → 步骤名 → 一行注释，三段间 32px 留白）
- 示例场馆同桌面（每场馆一段）
- 上传规则 bullet 间距收紧
- footer 文字稍小但保持 ≥12px

## 7. Key States

| 区域 | 状态 |
|---|---|
| 顶部 chrome | default / sticky 滚动后微透明覆盖（不是 glassmorphism，是 96% opacity Warm Rice Paper + 1px Hairline Ash 底边） |
| Hero | default / 字体 fallback 中（FOUT 期间 Serif 用 system serif 占位，禁止 FOIT） |
| CTA「打开图鉴」 | default / hover（描边色加深一档到 Sumi Ink 100%）/ focus（2px outline ring + 2px offset）/ pressed（背景从 Folio Cream 加深到 Hairline Ash 一档） |
| 使用流程三步 | 静态展示，无交互态 |
| 示例场馆链接 | default / hover（场馆名 underline 出现 + 右箭头从 `→` 微平移 2px）/ focus / pressed |
| 上传规则 | 静态展示；CC BY-NC 4.0 文字带 underline 表示外链 |
| Footer 链接 | 标准 link 三态（default / hover / focus） |
| 整页 | default / 第一次访问（走本页）/ 已有 localStorage（不走本页，直接 302 到上次场馆）/ JS 关闭 fallback（SSR 静态展示，CTA 用普通 `<a href>` 兜底） |

**特别说明**：本页**没有** loading / error / empty 状态 —— 内容全部 SSR 静态，没有 API 调用。这是首页"零摩擦"的一部分。

## 8. Interaction Model

### 入场判定

- 用户访问 `/` → Worker 检测 `Accept-Language` → 302 到 `/zh/` 或 `/ja/`
- 用户访问 `/[lang]/` → **客户端 hydration 后**读 `localStorage.getItem('seatview:last-venue')`：
  - 命中 → 立即 client-side 路由跳 `/[lang]/v/<last-venue-id>`（无过渡动画，体感等同于 SSR）
  - 未命中 → 停留在本页（保留 SSR 渲染好的内容）
- **不在 Worker 端读 localStorage**（Worker 看不到），所以 SSR 始终渲染说明页；客户端 hydration 决定是否跳转

### CTA「打开图鉴」点击

- 优先级判定：
  1. 如有 `localStorage:seatview:last-venue` → 跳上次场馆（理论上这种情况已经被入场判定拦截，仅作 fallback）
  2. 否则跳 `/[lang]/v/[first-venue-id]`，`first-venue-id` 取 PRD `top-15-venues.md` 的第一个（K Arena 横滨）
- 不打开任何模态 / Sheet / 抽屉

### 示例场馆链接点击

- 标准 client-side 路由跳 `/[lang]/v/[venue-id]`
- MVP 阶段示例场馆固定为：`k-arena-yokohama`、`tokyo-garden-theater`（来自 `top-15-venues.md`）
- 路由是 hard-coded 在本页（不查 D1）—— 因为示例场馆是开发者维护的展示选择

### Logo 点击行为

- 在场馆页 / 暂存区 / 后台等其他页点击左上角 `[SeatView]` logo → 跳回 `/[lang]/`
- **始终跳 `/[lang]/`**，不绕过 localStorage 判定 —— 如果用户已有 last-venue 历史，会立即被入场判定再跳回场馆页（用户体感：logo 是"回主页"按钮，但 SeatView 没有真正的主页，logo 实际等同于"回上次场馆"）
- 想看说明页 → 走 footer 的「关于」link，路径 `/[lang]/about`（**本 brief 暂不定义 about 页结构**，作为 Out of Shape Scope；MVP 可暂用本页 `/[lang]/` 在没有 localStorage 时的视图复用）

### 键盘

- Tab 顺序：顶部 chrome → CTA「打开图鉴」 → 示例场馆 1 → 示例场馆 2 → CC BY-NC 4.0 链接 → 「想贡献新场馆」 → footer 各链接
- `Enter` 在 CTA / 链接上等同点击
- 无 `Esc` 行为（本页无可关闭元素）

### Reduced motion

- CTA hover 的 underline 动画 / 右箭头 2px 微平移 → 在 `prefers-reduced-motion: reduce` 下改为即时切换
- 整页 fade-in / scroll reveal → **不实现**（本就不该有）

## 9. Content Requirements

### 双语文案（zh / ja，等价不翻译）

| 位置 | 中文 | 日本語 |
|---|---|---|
| Hero 一句话定位 | 抢票前的最后 30 秒，先看一眼那个座位真正能看到的。 | チケットを取る前の30秒、その席から実際に見える景色を確かめておく。 |
| Hero CTA | 打开图鉴 → | 図鑑をひらく → |
| 章节标题 1 | 怎么用 | 使い方 |
| 步骤 ① | 找场馆 / 从左侧场馆树或搜索框挑场馆。 | 会場を探す / 左の会場ツリーか検索から選ぶ。 |
| 步骤 ② | 看视角 / 点击坐席图上的标注点，看那个座位实拍的现场。 | 視点を見る / 座席図のピンをタップして、その席の実写を見る。 |
| 步骤 ③ | 上传 / 拍下你自己的座位视角，照同样的方式标在坐席图上分享。 | 投稿する / 自分の席からの一枚を撮って、同じ要領で座席図に置く。 |
| 章节标题 2 | 推荐先看 | おすすめ |
| 示例场馆 1 名称 | Kアリーナ横浜 / K Arena Yokohama | Kアリーナ横浜 / K Arena Yokohama |
| 示例场馆 1 注释 | 多层环绕，4 个 sub-map 共 100+ 张视角 | 多層環状、4つのフロアに100以上の視点投稿 |
| 示例场馆 2 名称 | 東京ガーデンシアター / 东京花园剧场 | 東京ガーデンシアター |
| 示例场馆 2 注释 | 8000 席，最佳观演视角的争议地 | 8000席、ベストポジションが議論を呼ぶ会場 |
| 章节标题 3 | 关于上传 | 投稿について |
| 上传规则 bullet 1 | 必须是你本人拍摄的照片。 | あなた自身が撮影した写真であること。 |
| 上传规则 bullet 2 | 请遮蔽他人面部和可识别个人信息。 | 他人の顔や個人を識別できる情報は隠してください。 |
| 上传规则 bullet 3 | 内容以 CC BY-NC 4.0 协议分享 ↗ | 投稿はCC BY-NC 4.0で共有されます ↗ |
| 限频注脚 | 一天每人最多上传 10 张。这样能让所有人看到的内容质量保持稳定。 | 1日あたり10枚まで投稿できます。みんなが見る内容の質を保つためです。 |
| 贡献入口 | 想贡献新场馆？通过 GitHub 提交 ↗ | 新しい会場を提案する？GitHubから ↗ |
| Footer | GitHub · 关于 · 隐私政策 · 服务条款 | GitHub · このサイトについて · プライバシー · 利用規約 |
| 版权行 | © SeatView · 真实视角图集 | © SeatView · リアル座席ビュー |

### 字段来源（数据契约）

- 示例场馆名 / 罗马字 / 注释：硬编码在本页对应 i18n message 文件里，**不查 D1**。理由：本页是开发者维护的展示选择，不是数据驱动。
- 示例场馆 venue-id（`k-arena-yokohama` / `tokyo-garden-theater`）：必须与 `data/venues/<venue-id>.json` 的 `id` 字段一致，否则跳转 404。
- 协议链接：`https://creativecommons.org/licenses/by-nc/4.0/`（外链，新 tab）
- GitHub 链接：暂定 `https://github.com/<owner>/seatmap-real`（实际地址在部署时敲定）

### 图像资源

- **零图像资源**。整页不依赖任何 raster 图片 —— 没有 hero 图、没有示例场馆截图、没有装饰插画。这是"中度图鉴卷首序 + 严守极克制 + 极简文字链接"三个决策叠加后的必然结果。
- 仅有的 SVG 资源：CTA 右箭头 `→`（inline，1.5px stroke），footer 链接的外链标识 `↗`（inline）。

## 10. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载 `.claude/skills/impeccable/reference/` 下：

- `typography.md` —— Serif Display 与 Sans Body 的字号比例、双语字体 fallback 栈、FOUT/FOIT 策略
- `spatial-design.md` —— hero 一屏自适应、章节间的垂直节奏、680px 主区宽度的呼吸感
- `color-and-contrast.md` —— 整页纯中性色四档的 OKLCH 具体值敲定（首次落地，会被后续所有页面继承）
- `responsive-design.md` —— 三档断点（≥1024 / 768-1023 / <768）的字号缩放与布局重排
- `interaction-design.md` —— CTA / 链接的三态机、reduced-motion 降级
- 已存在的 task-local `shape-venue-page.md` —— 顶部 chrome 的高度 / sticky 行为 / logo 跳转契约
- 已存在的 task-local `shape-seatmap-component.md` —— 仅为了理解"朱赤的语义垄断地位"，不直接被本页使用

## 11. Open Questions

无真正未决。剩余细节已断言默认值：

- **示例场馆固定为 K Arena 横滨 + 东京花园剧场**：来自 `top-15-venues.md` 头两个，与 PRD R10.1 列举一致；如未来想换示例，改 i18n message + 路由 hardcode 即可。
- **`/[lang]/about` 是否独立页**：MVP 阶段**不实现**独立 about 页；footer 的「关于」link 暂指向 `/[lang]/`（说明页本身就是 about）。等用户群增长后再 split。
- **Hero Serif 字号桌面 96px / 平板 72px / 移动 48px**：与 DESIGN.md 的 ≥1.25 字号比一致（96 / 72 ≈ 1.33；72 / 48 ≈ 1.5）。
- **主区最大宽度 680px**：守 PRODUCT.md 提到的 65-75ch 行宽上限（按 Noto Sans JP 18px 字号大约对应 38 个全角字符或 75 个半角字符，落在 680px 安全区内）。
- **CTA 按钮尺寸**：高度 48px，水平 padding 32px，圆角 4px（不是 pill，不是直角；图鉴书页边缘感）。
- **章节间垂直留白**：桌面 96px / 平板 72px / 移动 56px。
- **章节标题中日并排的分隔符**：使用 `＼/`（来自 Are.na 文化版面式排版），不用斜杠 `/`、不用竖线 `|`、不用 em dash。

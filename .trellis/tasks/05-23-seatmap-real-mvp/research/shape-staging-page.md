# Shape Brief — 暂存区页面（Staging / 想看的场馆）

> 来源：`/impeccable shape 暂存区页面` 产出，用户已确认三处核心决策（2026-05-24）。trellis-implement 实施前必读。
>
> 范围：`/[lang]/staging` 整页 —— 单字段「场馆名」提交表单 + 倒序「心愿名录」列表。覆盖 PRD R6（暂存区）+ R8.2（限频 5 次/天）+ R8.3-4（Turnstile + KV 计数）+ R13.1（双通道的需求收集端）+ R13.4（与 GitHub PR 通道并行）。
> **顶部 chrome（logo + 语言 + 主题切换）与 footer 已在 [`shape-home-explainer.md`](shape-home-explainer.md) / [`shape-venue-page.md`](shape-venue-page.md) 定义；本 brief 复用之，不重复定义。GitHub PR 教程通道（R13.2/R13.3 的 `CONTRIBUTING.md` 与 PR template）不在本 brief，仅在本页底部用一行透明文案引出该通道。维护者后台处理（R7）不在本 brief。**

## 1. Feature Summary

SeatView 的「想看的场馆」征集页。任何用户（无需注册）发现自己想看的场馆还没被收录时，在这里写下场馆名提交；提交会以倒序进入一本大家共写的「心愿名录」。维护者日后通过 GitHub PR（ADR-1 / ADR-9）把名录里合适的场馆补上坐席图与资料、转为正式场馆，并在该行标记「已收录」。

**这是 SeatView 整站唯一一个没有照片的页面。** 其他所有 surface 都靠用户实拍图撑起 ≥70% 视觉重量与温度，暂存区只有一个输入框和一串文字场馆名。它因此同时贴着两条 anti-reference 边线：（a）滑向「极简到冷漠」的开发者 demo（纯白纯黑无温度）；（b）为热闹而滑向「社区许愿板 / feature-request board」式喧闹（点赞、投票、+1）——而 PRD R6.5 明确禁了 +1。本页的设计核心命题就是：**在没有图像可依靠的前提下，靠排版克制 + 文案 + 芳名帳式名录隐喻承载温度，两条边都不踩。**

## 2. Primary User Action

「我把一个还没被收录、但我想看的场馆名字，无需注册地、十几秒内地、不被任何政策弹窗打断地，写进这本大家共写的名录里。」其余动作（翻看别人想看什么、确认自己提的是否已被收录、转去 GitHub 自己加数据）都是次级。

## 3. Design Direction

- **Color strategy**：**Restrained**。与首页（朱赤完全不出现）不同，本页**允许且仅允许一处朱赤** —— 提交按钮的 tinted fill（详见决策 3）。其余整页只用 Sumi Ink / Warm Rice Paper / Folio Cream / Hairline Ash 四档中性色。**「已收录 ✓」标记不是朱赤**（见决策 2 派生），守住朱赤"标注点 selected + 上传按钮 + 本页提交按钮"的语义边界，不让它滑成装饰色。
- **Theme**：Light-first（继承全站）。Dark 在 `/impeccable adapt` 阶段统一补全。
- **Theme scene sentence**：「一名粉丝逛完 SeatView，发现自己常去的那个 Livehouse 还没被收录，在某个晚上回到家、坐在桌前，顺手把这个场馆名写下来留在名录里 —— 他不需要解释为什么想看，也不指望立刻得到回应，只是把名字记进一本大家共写的册子，期待哪天有人补上坐席图。」→ Light-first（继承）；低压力、无即时回报、记帳簿式的安静心境；说服路径要短、提交摩擦要低。
- **Anchor references**：
  - **muji 表单 / 列表** —— 单字段表单与文字列表的极简、留白承载呼吸
  - **Are.na index / channel 列表** —— 工具型站点的文字主导「名录」表达：不卖弄、不营销、纯粹的条目登记
  - **新增：日本传统「芳名帳 / 記帳簿」** —— 名录的精神原型：人们把名字写进一本共写的册子，没有点赞、没有排名，只是一条接一条的安静登记。这是「在无图页面承载温度而不滑向社交喧闹」的核心隐喻来源。

Phase 1.5 视觉探针：harness 无 native image generation，跳过。

## 4. Decisions Locked (2026-05-24)

用户在 shape 阶段已确认的三处骨架决策：

1. **页面骨架** → **「投稿箱 + 心愿名录」**。表单在顶部（提问 + 单字段 + 朱赤提交 + 一句透明说明），下方一条 Hairline Ash 分隔，再接倒序名录列表。整页居中阅读流（非图像流）。**不**做工具型左右双栏（过冷、像 SaaS 后台）；**不**做列表为主把表单折叠（弱化提交动作、空列表时整页空白）。温度来自排版克制 + 空状态文案 + 芳名帳隐喻，不靠任何社交件。
2. **名录每行内容** → **场馆名（用户原文）+ 提交日期 + 收录标记**。`processed_at` 有值时显示克制的「✓ 已收录 / 収録済み」。这个闭环反馈是缝隙时刻的温度，且**不是计数 / 不是投票**，不违反 R6.5。
3. **提交按钮颜色** → **朱赤 tinted fill**。暂存提交是真实的"贡献行为"（提交想看的场馆），与上传按钮同类，理应享有朱赤；规格沿用场馆页/上传 Sheet 的上传按钮（朱赤极淡填充 chroma ~0.04 + 墨黑文字）。区别于首页 CTA 的墨黑 outline —— 首页 CTA 是"导航"，本页提交是"贡献"。

派生决策（由上述三条 + 跨 brief 一致性强制推出）：

- **字体 → Sans-only（对 Q1 预览中"Serif 标题"标注的有意修正，可推翻）**：`shape-home-explainer.md` 已声明首页是 Folio Title Rule"唯一额外允许 Serif Display 出场的位置"（Serif 仅限场馆名 / 演出名 / 首页 hero）。为守住 Serif 的稀有性与跨 brief 一致，**暂存区全页用 Sans**，包括顶部提问与名录 section header。温度由文案 + 留白 + 名录隐喻承载，不借 Serif。若要给本页破例一处 Serif，须同步修订 home-explainer 的"唯一"声明 —— 故标为可推翻断言（见 §11）。
- **「✓ 已收录」标记色 → Sumi Ink，不是朱赤、不是绿色**：朱赤在本页已被提交按钮占用，收录标记若再用朱赤会稀释语义；绿色是 SaaS success-state 反射，与克静纸面冲突。沿用上传 Sheet 「Sumi ✓ 已完成」的同款墨色对勾，保持单色名录气质。
- **名录行不可点击（非链接）**：这些场馆**还不存在**，没有可跳转的 `/v/[venue-id]`。行是纯文字登记，不是导航。点击无行为、不加 hover 链接态、不进 Tab 焦点序列。这与瀑布流卡片（可点开 Lightbox）根本不同，须显式区分避免 sub-agent 误加链接。
- **本页底部引出 GitHub PR 高门槛通道（R13.2 / R13.4）**：一行透明文案「能做更多？你也可以自己通过 GitHub 添加坐席图和资料 ↗」。两条通道并行、定位区分清楚：名录 = "只告诉名字，剩下交给维护者"（低门槛）；GitHub = "自己把数据加上"（高门槛）。
- **本页无左侧场馆树**：场馆树用于浏览已收录场馆（R1/R10.3）；暂存区是请求**尚未收录**的场馆，挂场馆树会矛盾且分散。本页布局同首页说明页 —— 复用顶部 chrome + footer，主区居中，无树。

## 5. Scope

- **Fidelity**：production-ready
- **Breadth**：整张 `/[lang]/staging`（提交表单 + Turnstile + 限频态 + 倒序名录列表 + 续批加载 + GitHub 通道引出 + footer）。**不含** 顶部 chrome / footer 本体（复用）、GitHub PR 教程页与 `CONTRIBUTING.md`、维护者后台、`/api/staging` 端点实现（本 brief 定义其请求/响应契约，实现归后端）。
- **Interactivity**：shipped-quality（三档响应式、键盘可达、深浅色继承、reduced-motion 降级、IP 限频拦截、Turnstile 两步验证、提交后乐观插入）。
- **Time intent**：polish 到可直接交给 trellis-implement 落地。

## 6. Layout Strategy

### 桌面端（≥1024px）

```
┌───────────────────────────────────────────────────────────┐
│  [SeatView]                              [ja│zh]  [☀/🌙/⚙] │  sticky chrome（复用；无场馆树）
├───────────────────────────────────────────────────────────┤
│                                                           │
│        想看的场馆还没有收录？      ＼/  見たい会場がまだ無い？  │  ← Sans 700 28px 提问（中日并排）
│                                                           │
│        ┌──────────────────────────────────┐  [  提交  ]  │  ← 单字段 input + 朱赤 tinted fill 提交
│        └──────────────────────────────────┘              │
│                                                           │
│        只要告诉我们场馆名就够了。坐席图和资料                  │  ← Sans 14px 灰发线色 透明说明
│        由维护者通过 GitHub 整理后加入。                       │
│                                                           │
│        [ Turnstile widget · 输入后渲染 ]                    │  ← 输入框有内容/提交意图时才渲染
│        每人每天最多提交 5 个，避免重复刷屏。                   │  ← Sans 13px 更次级 限频说明
│                                                           │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  ← Hairline Ash 分隔（表单/名录界）
│                                                           │
│   大家想看的                          ＼/  みんなのリクエスト │  ← Sans 700 20px section header
│                                                           │
│   さいたまスーパーアリーナ                          3 天前   │  ← 行：原文场馆名（左）+ 日期（右，次级，tabular-nums）
│  ───────────────────────────────────────────────────────  │  ← 1px Hairline Ash 行间分隔
│   幕張メッセ                              5 天前  ✓ 已收录  │  ← 收录标记 Sumi ✓（右端，日期之后）
│  ───────────────────────────────────────────────────────  │
│   横浜アリーナ                                      6 天前   │
│  ───────────────────────────────────────────────────────  │
│   （IntersectionObserver 自动续批，无「加载更多」按钮）        │
│                                                           │
│   能做更多？你也可以自己通过 GitHub 添加坐席图和资料 ↗         │  ← Sans 14px PR 高门槛通道引出
│                                                           │
│   GitHub  ·  关于  ·  隐私政策  ·  服务条款                  │  ← footer（复用 home-explainer）
│   © SeatView · 真实视角图集                                 │
└───────────────────────────────────────────────────────────┘
```

- **主区最大宽度**：680px 居中（同首页说明页 —— 阅读流而非图像流，守 65-75ch；比场馆页 900px 窄）。
- **整页节奏**：表单区上方 chrome 下留 ~72px；表单与名录间 Hairline 分隔上下各 ~48px 呼吸；名录行高松弛（每行垂直 padding ~16px）让"名录"有记帳簿的从容，不挤成票务站密集小字。
- **提问中日并排**：用 `＼/` 装饰性斜线分隔（继承 home-explainer 约定），两个等价标题并立，非翻译关系。

### 平板（768-1023px）

主区最大宽度 568px 居中；提问 Sans 缩到 24px；表单仍 input + 提交同行（input 收窄）；名录行结构同桌面；其余同桌面。

### 移动端（<768px）

- 顶部 chrome 简化为 `[SeatView] [ja│zh] [☀/🌙]`（复用首页移动 chrome）。
- 主区左右 padding 24px；最大宽度 100%。
- 提问 Sans 缩到 20px。
- **表单纵排**：input 占全宽 → 下方朱赤提交按钮占全宽（≥44px 高，触达达标）。
- 透明说明 / 限频说明字号略小但 ≥12px。
- **名录行纵排两行**：第一行场馆名（可换行，不截断 —— 用户原文场馆名可能较长）；第二行右对齐日期 + 收录标记。行间 1px Hairline Ash 分隔。
- GitHub 通道行与 footer 同桌面，字号收紧。

## 7. Key States

| 区域 | 状态 |
|---|---|
| 顶部 chrome | default / sticky 滚动后 96% opacity Warm Rice Paper + 1px Hairline Ash 底边（复用 home-explainer，非 glassmorphism） |
| 场馆名 input | default（placeholder）/ focus（2px outline ring）/ 有内容（提交按钮 enabled + Turnstile 渲染）/ 空提交尝试（inline 提示，不红边轰炸）/ 字符超限（自由文本上限见 §8） |
| Turnstile | 未渲染（输入框为空时）/ loading / passed / failed（inline 一行说明 + 重试） |
| 提交按钮 | disabled（input 为空 或 Turnstile 未过）/ default（enabled，朱赤 tinted fill）/ hover（朱赤填充加深一档）/ focus / pressed / 提交中（文字转「提交中…」+ 细线进度，按钮 disabled） |
| 提交结果 | 成功（新行乐观插入名录顶部 + 表单清空 + 一行克制确认 + 新行短暂 Folio Cream 高光淡出）/ 失败（提交按钮上方 inline 错误 + 重试，不弹 toast）/ **限频拦截**（5 次/天已满，inline 克制说明，按钮 disabled） |
| 名录列表 | default（有条目）/ **空（缝隙时刻，温柔文案）** / 首批 loading（Folio Cream 占位块，**不画 shimmer**，继承瀑布流策略）/ 续批 loading（底部自动，无 spinner 无「加载中」文字）/ 续批/整批 load 失败（一行克制提示，60s 后静默重试一次，不弹 toast） |
| 名录行 | 默认（场馆名 + 日期）/ 已收录（追加 Sumi ✓ 已收录）/ 刚提交（短暂高光淡出）。**无 hover / 无 focus / 无点击态**（非链接） |
| 整体 | default / reduced-motion 降级（新行高光淡出与续批渐入改即时切换；其余本就无动效）/ JS 关闭 fallback（名录首批 SSR 静态可读；表单提交退化为标准 `<form method=post>` 到 `/api/staging`，Turnstile 缺失时后端按无 token 拒绝并返回可读错误页） |

### 「缝隙时刻」温度策略（DESIGN.md 已批准在空/成功/错误等缝隙允许人情味）

- **空名录**（最重要的缝隙）：温柔但不卖萌 —— 「还没有人写下想看的场馆。第一个，由你来。」这是本页在无图前提下承载温度的关键位置。
- **提交成功**：克制温柔 —— 「收到了。已经记在名录最前面。」**不**用 Serif Display、**不**用自绘符号、**不**用粒子/光晕（那些是上传成功页的专属 —— 贡献一张实拍图的分量 > 提交一个名字；本页成功反馈必须比上传成功更轻）。
- **限频拦截 / 提交失败 / 加载失败**：克制说明，不归罪、不感叹（继承上传 Sheet 与瀑布流的克制错误文风）。

## 8. Interaction Model

### 渲染与水合

- 名录**首批 SSR**（Worker 查 `staging_venues` 倒序前 N 条，`WHERE processed_at` 透出收录态）—— 利于 SEO + 首屏零摩擦可读。
- 表单是 **React Island**（`client:load`：本页核心动作就是提交，不延迟水合）。
- 续批通过 **IntersectionObserver** 触底拉取（`client:visible`），无显式按钮。

### 提交流程

1. 用户在 input 写场馆名（自由文本）。input 有内容 → Turnstile widget 渲染（避免空页过早消耗 token）+ 提交按钮 enabled。
2. 点提交 / 在 input 按 `Enter` → 校验：场馆名非空（trim 后）、Turnstile token 有效。
3. `POST /api/staging`（body：`{ name, turnstileToken }`）。
4. **成功（2xx）**：把新条目乐观插入名录顶部（`created_at` = now，无收录态）→ 表单清空、input 重新 focus → 新行短暂 Folio Cream 高光淡出（~600ms ease-out）→ 表单下方一行克制确认。
5. **限频（429）**：提交按钮上方 inline 显示「今天已提交 5 个」克制文案，按钮 disabled（当日）。
6. **其他失败（网络 / 5xx）**：inline 错误 + 「再试一次」，input 内容保留不丢。
7. **不可编辑 / 不可撤回**已提交条目（继承 ADR-2 无账户身份 → 无法稳定鉴权编辑；MVP 简化）。

### 名录浏览

- 倒序（最新在前，R6.4）。
- 续批：触底自动加载下一批（断言批量 50，纯文字轻量）。
- 行**不可交互**：无点击、无跳转、无 hover 链接态。

### 键盘

- Tab 顺序：chrome → input → 提交按钮 → （Turnstile 若需交互）→ GitHub 通道链接 → footer 链接。**名录行不进 Tab 序**（非交互）。
- `Enter` on input：等同点提交（Turnstile 通过的前提下）。
- 无 `Esc` 行为（本页无可关闭元素 —— 无 modal、无 sheet，守"模态优先"反例）。

### Reduced motion

- 新行高光淡出、续批 opacity 渐入 → `prefers-reduced-motion: reduce` 下改即时切换。
- 本页无其他动效（无 slide、无 scroll-reveal）。

### 自由文本约束（断言）

- 场馆名 input：`maxlength` ~80 字符（够长容纳「さいたまスーパーアリーナ」级别全名 + 区域注记，又防滥用）；前后 trim；空白串拒绝提交。
- 用户原文**不翻译、不规范化**（继承 R9.5 精神：用户输入保持原样），无论当前 UI 语言，名录里始终显示提交者写下的原文。
- 后端做基本清洗（去首尾空白、长度截断、必要的转义防 XSS），不做语义改写。

## 9. Content Requirements

### 数据契约

- **读**：名录从 `staging_venues` 倒序取 `{ id, name, created_at, processed_at }`。`processed_at != null` → 渲染「✓ 已收录」。`ip_hash` 不下发前端。
- **写**：`POST /api/staging` body `{ name: string, turnstileToken: string }`；后端校验 Turnstile（两步：token → JWT，见 cloudflare-astro-stack.md）→ 校验 KV 限频 `ratelimit:staging:<ip_hash>:<YYYY-MM-DD>`（5/天，R8.2 + Data Model）→ 写 D1（`id` = ulid，`ip_hash` 存哈希不存原 IP）→ 返回新建条目（或 429 / 4xx / 5xx）。错误响应结构遵循 [`.trellis/spec/backend/error-handling.md`](../../../spec/backend/error-handling.md)，文案中日双语。
- **日期呈现**：相对格式（「刚刚 / 3 天前」「たった今 / 3日前」），`<time datetime=ISO title=绝对时间>` 包裹以便无障碍与悬停查看精确时间；数字用 tabular-nums，Hairline Ash 次级色。

### 双语文案（zh / ja，等价不翻译）

| 位置 | 中文 | 日本語 |
|---|---|---|
| 页面/导航标题（对外，区别于内部代号"暂存区"） | 想看的场馆 | 見たい会場 |
| 表单提问 | 想看的场馆还没有收录？ | 見たい会場がまだ無い？ |
| input placeholder | 输入场馆名，例「さいたまスーパーアリーナ」 | 会場名を入力（例：さいたまスーパーアリーナ） |
| 提交按钮 | 提交 | 送信 |
| 提交中 | 提交中… | 送信中… |
| 透明说明（为什么只要名字） | 只要告诉我们场馆名就够了。坐席图和资料由维护者通过 GitHub 整理后加入。 | 会場名だけで大丈夫。座席図やデータは管理者が GitHub で整えてから追加します。 |
| Turnstile 说明 | 这一步是为了防止机器人批量提交。 | bot による大量送信を防ぐための確認です。 |
| 限频说明（常驻） | 每人每天最多提交 5 个，避免重复刷屏。 | 1日5件まで。重複や荒らしを防ぐためです。 |
| 名录 section header | 大家想看的 | みんなのリクエスト |
| 收录标记 | ✓ 已收录 | ✓ 収録済み |
| 空名录（缝隙时刻） | 还没有人写下想看的场馆。第一个，由你来。 | まだ誰も書いていません。最初の一つを、あなたから。 |
| 提交成功（inline） | 收到了。已经记在名录最前面。 | 受け取りました。名録の先頭に加えました。 |
| 空场馆名提交 | 写下场馆名再提交。 | 会場名を入力してください。 |
| 提交失败（inline） | 没提交成功，再试一次？ | 送信できませんでした。もう一度お試しください。 |
| 限频拦截（5/天） | 你今天已经提交 5 个了。明天再来。 | 本日の送信は上限（5件）に達しました。 |
| Turnstile 失败 | 验证没通过，刷新后再试。 | 認証に失敗しました。更新して再度お試しください。 |
| 名录加载失败 | 名录暂时加载不出来。 | 名録を今読み込めません。 |
| 相对时间 | 刚刚 / N 分钟前 / N 小时前 / N 天前 | たった今 / N分前 / N時間前 / N日前 |
| GitHub 高门槛通道 | 能做更多？你也可以自己通过 GitHub 添加坐席图和资料 ↗ | もっと手伝える？GitHub から座席図やデータを直接追加できます ↗ |
| Footer（复用 home-explainer） | GitHub · 关于 · 隐私政策 · 服务条款 / © SeatView · 真实视角图集 | GitHub · このサイトについて · プライバシー · 利用規約 / © SeatView · リアル座席ビュー |

### 图像 / 视觉资源

- **零图像资源**。整页不依赖任何 raster 图片（本就是无图页面，这正是本 brief 的核心命题）。
- 仅有的 inline SVG/字符：收录标记 ✓（Sumi，inline）、GitHub 通道外链标识 ↗、Turnstile 由 Cloudflare widget 自渲染。
- 占位/加载/错误一律 Folio Cream 块，不画 shimmer（继承瀑布流，拒绝 SaaS 模板语言）。

## 10. Recommended References

implementation 阶段（trellis-implement / craft / sub-agent）应优先加载 `.claude/skills/impeccable/reference/` 下：

- `interaction-design.md` —— 单字段表单提交、Turnstile 两步、乐观插入、限频/失败状态机、focus 管理
- `color-and-contrast.md` —— 提交按钮朱赤 tinted fill（沿用上传按钮 chroma ~0.04）、收录标记 Sumi ✓ 的对比度、四档中性色（已在首页落地，本页继承）
- `spatial-design.md` —— 680px 阅读列、表单/名录节奏、名录行高与 1px Hairline 分隔的记帳簿从容感
- `responsive-design.md` —— 三档断点（≥1024 / 768-1023 / <768）的表单纵排与名录行重排
- `typography.md` —— **确认本页 Sans-only**（守 Folio Title Rule）、日期 tabular-nums、名录行字号层级
- 已存在的 task-local `shape-home-explainer.md` —— 顶部 chrome / footer 契约、680px 列、`＼/` 中日并排约定、"朱赤在本页之外不滥用"的纪律来源、**其"Serif 唯一额外例外"声明（本页 Sans-only 的依据）**
- 已存在的 task-local `shape-upload-sheet.md` —— 朱赤提交按钮规格、Turnstile-on-interaction、限频/透明"为什么"文案范式、Sumi ✓ 标记同款
- 已存在的 task-local `shape-photo-grid.md` —— Folio Cream 占位不画 shimmer、IntersectionObserver 续批无按钮、整批失败 60s 静默重试的不打扰原则
- 后端 `cloudflare-astro-stack.md` + `.trellis/spec/backend/error-handling.md` —— `/api/staging` 的 Turnstile 两步、KV 限频、D1 写入、错误响应契约

## 11. Open Questions

无真正未决。剩余细节已断言默认值（implementation 阶段若有真机/Lighthouse 调参可微调）：

- **【可推翻断言 · 需用户留意】本页 Sans-only**：为守 Folio Title Rule 并与 `shape-home-explainer.md`"Serif 唯一额外例外"声明一致，本页不使用 Serif Display（已修正 Q1 预览中的"Serif 标题"标注）。若坚持给顶部提问破例一处 Serif，须同步修订 home-explainer 的"唯一"措辞——否则两 brief 冲突。
- **【跨 brief 契约 · 用户已确认 2026-05-24】暂存区入口在左侧场馆树底部（footer 次级兜底）**：本页需可被发现。**主入口**放在**左侧场馆树底部**（[`shape-venue-page.md`](shape-venue-page.md) 定义的场馆树 —— 桌面常驻、移动抽屉）——理由：用户正是在浏览场馆树、没找到自己想去的场馆的那一刻最该看到"提交想看的场馆"，这是上下文最贴合的位置。文案如「想看的场馆没有？写下来 / 見たい会場が無い？リクエスト」，置于树最末一区划之后，与树条目视觉区分（非区划、非场馆，是一个动作入口）。**次级兜底**：全站 footer 可再放一个 `/[lang]/staging` 链接（与既有「GitHub PR 贡献」入口并列且定位区分：一个=只报名字，一个=自己加数据）。实施时需回头给 `shape-venue-page.md` 的场馆树底部补这一项。
- **名录批量 50 / 续批 IntersectionObserver**：纯文字轻量，50 条/批；触底自动续，无按钮无 spinner（继承瀑布流哲学）。
- **场馆名 maxlength ~80、trim、不翻译不规范化**：见 §8。后端做长度截断 + XSS 转义，不改写语义。
- **收录标记仅展示态、无筛选**：MVP 不做「只看已收录 / 未收录」过滤；名录就是单一倒序流。出现规模问题再加（与 PRD"不做 +1/筛选"的克制一致）。
- **成功反馈强度低于上传成功**：本页成功是 inline 一行 + 新行高光淡出；不借 Serif/自绘符号/动画（那是上传成功页专属）。理由：提交一个名字的分量 < 贡献一张实拍图。
- **提交按钮朱赤 chroma**：沿用上传按钮同值（~0.04 tinted fill + 墨黑文字），不另调，保持朱赤"贡献动作"在全站观感一致。

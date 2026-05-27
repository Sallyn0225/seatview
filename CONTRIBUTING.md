# 为 SeatView 添加新场馆 / SeatView に会場を追加する

> 这份教程面向**不会写代码的贡献者**。你不需要安装任何东西，全程在 GitHub 网页上完成：Fork → 编辑一个文本文件 → 提 Pull Request（PR）。维护者审核合并后，新场馆就会出现在站点上。
>
> SeatView 收集新场馆有**两条并行通道**（prd R13）：
>
> 1. **只想告诉我们场馆名** → 去站内「想看的场馆」页（`/zh/staging` 或 `/ja/staging`）写下名字即可，剩下交给维护者。门槛最低。
> 2. **愿意自己把场馆数据加上**（本教程）→ 通过 GitHub 网页提交一个场馆 JSON 文件。门槛稍高，但你的贡献会被直接合并。

---

## 场馆数据长什么样

每个场馆是 `data/venues/` 目录下的**一个 JSON 文件**，文件名就是这个场馆的 `id`，例如 `data/venues/k-arena-yokohama.json`。

参考模板：[`data/_venue-template.json`](data/_venue-template.json)（一个填好示例值的样板，复制它改成你的场馆即可）。一个示例（单坐席图场馆，贡献者可用占位 `.svg` 路径起步，维护者合并后会替换为 `.webp`）：

```json
{
  "id": "tokyo-garden-theater",
  "name_zh": "东京花园剧场",
  "name_jp": "東京ガーデンシアター",
  "name_romaji": "Tokyo Garden Theater",
  "prefecture": "tokyo",
  "city": "江東区",
  "aliases": [
    "東京ガーデンシアター",
    "东京花园剧场",
    "Tokyo Garden Theater",
    "ガーデンシアター"
  ],
  "subMaps": [
    {
      "id": "default",
      "label_zh": "全场",
      "label_jp": "全体",
      "imageUrl": "/seatmaps/tokyo-garden-theater/default.svg",
      "width": 1200,
      "height": 800
    }
  ]
}
```

多坐席图的场馆（例如 K Arena 横滨分 L1 / L3 / L5 / L7 几层），就在 `subMaps` 数组里放多个对象，每个对象一个 tag。参考 [`data/venues/k-arena-yokohama.json`](data/venues/k-arena-yokohama.json)。

> 提示：JSON **不支持注释**，也不能有多余的逗号。复制模板后，把每个值改成你的场馆即可，不要保留示例文字。

---

## 字段逐项说明

字段名与代码里的 `Venue` / `SubMap` 类型（[`src/types/venue.ts`](src/types/venue.ts)）一一对应，请勿增删字段名。

### 场馆顶层（`Venue`）

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `id` | ✅ | string | **url-safe slug**：全小写、用连字符 `-` 分词，例如 `k-arena-yokohama`。**必须全站唯一**，且 JSON 文件名要等于 `<id>.json`。它会出现在场馆页 URL `/<lang>/v/<id>` 里。 |
| `name_zh` | ✅ | string | 场馆中文名。切换到中文界面时显示。 |
| `name_jp` | ✅ | string | 场馆日文名。切换到日文界面时显示。 |
| `name_romaji` | ✅ | string | 罗马字 / 英文名，作为副标题显示，也参与搜索。 |
| `prefecture` | ✅ | string | 都道府县的 **slug**，必须取自 [`src/data/prefectures.ts`](src/data/prefectures.ts)（见下方对照表）。海外场馆用 `overseas`。它决定场馆挂在左侧场馆树的哪个分支。 |
| `city` | ✅ | string | 城市 / 区名，自由文本（如 `横浜市`、`江東区`）。 |
| `aliases` | ✅ | string[] | 别名数组，用于搜索命中（Fuse.js）。把中文名、日文名、罗马字、常见简称都放进来，让 "K Arena" / "横浜 K" / "Kアリーナ" 都能搜到同一个场馆。可以为空数组 `[]`，但强烈建议填。 |
| `subMaps` | ✅ | SubMap[] | 坐席图数组，**至少一个**。单坐席图的场馆也要放一个（习惯用 `id: "default"`）。 |

### 坐席图（`subMaps[]` 里每个对象 = `SubMap`）

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `id` | ✅ | string | sub-map 的 url-safe slug，在**同一场馆内唯一**，例如 `L3`、`default`、`arena-center`。它会作为场馆页顶部切换 tag 的 query（`?tab=<id>`）。 |
| `label_zh` | ✅ | string | tag 的中文文本（如 `L3 三层`、`全场`）。 |
| `label_jp` | ✅ | string | tag 的日文文本（如 `L3 フロア`、`全体`）。 |
| `imageUrl` | ✅ | string | 坐席图地址，站内静态资源路径。贡献者可先填占位 `.svg`（跑 `npm run gen:seatmaps` 生成占位图）；已收录场馆由维护者上传 `.webp`，对应 `public/seatmaps/...` 下的文件。 |
| `width` | ✅ | number | 坐席图原始宽度（像素）。标注点坐标按百分比换算，需要这个值。 |
| `height` | ✅ | number | 坐席图原始高度（像素）。 |

### `prefecture` slug 对照（常用）

完整列表见 [`src/data/prefectures.ts`](src/data/prefectures.ts)。常用：

| slug | 中文 | 日文 |
|---|---|---|
| `hokkaido` | 北海道 | 北海道 |
| `tokyo` | 东京都 | 東京都 |
| `kanagawa` | 神奈川县 | 神奈川県 |
| `saitama` | 埼玉县 | 埼玉県 |
| `chiba` | 千叶县 | 千葉県 |
| `osaka` | 大阪府 | 大阪府 |
| `aichi` | 爱知县 | 愛知県 |
| `fukuoka` | 福冈县 | 福岡県 |
| `overseas` | 海外 | 海外 |

> 用错 slug（写成一个 `prefectures.ts` 里不存在的值）不会让构建失败，但场馆会挂不到树上、无法被浏览到。务必从对照表里照抄。

---

## 关于坐席图（重要：版权）

**不要提交真实的、有版权的官方坐席图。** 票务平台 / 场馆官网的坐席图通常受版权保护。

仓库里 `public/seatmaps/` 下已收录场馆的坐席图，均为**维护者上传**的坐席图（WebP，非官方版权图）。当你新增一个场馆、`imageUrl` 仍指向 `/seatmaps/...svg` 时，下面这个脚本会为它生成一张**占位 SVG**（米白纸面 + 抽象座席轮廓），仅用于本地开发时让坐席图、瀑布流、Lightbox 有东西可渲染：

```bash
node scripts/gen-placeholder-seatmaps.mjs
```

这个脚本会读取每个 `data/venues/*.json`，为其中 `imageUrl` 指向 `/seatmaps/...svg` 的 sub-map 生成一张占位 SVG（尺寸取你写的 `width` / `height`）。

**给非编码贡献者的实用建议**：你只需要在 PR 里**用文字说明这个场馆有几层 / 几个分区**，并把 `subMaps` 写好、`imageUrl` 指向占位路径即可。坐席图本身的「截图待补」可以留给维护者处理。**不要伪造图片，也不要上传你没有授权的图片。**

---

## 提交步骤（GitHub 网页，无需安装任何东西）

1. **Fork** 本仓库（点右上角 Fork）。
2. 在你的 Fork 里进入 `data/venues/` 目录，点 **Add file → Create new file**。
3. 文件名填 `<你的场馆-id>.json`（例如 `yokohama-arena.json`）。
4. 把 [`data/_venue-template.json`](data/_venue-template.json) 的内容粘进去，逐个字段改成你的场馆。对照上面的「字段逐项说明」。
5. 页面底部 **Commit new file**（可以直接提交到一个新分支）。
6. 回到原仓库，发起 **Pull Request**。PR 模板会自动带出一份检查清单，逐项确认：
   - 坐席图无版权风险
   - 字段完整
   - `id` 唯一
   - 本地 build 通过（如果你会跑的话；不会也没关系，维护者会跑）
7. 等待维护者审核合并。合并到 `main` 后会自动部署（CD），新场馆即上线（ADR-1：场馆是静态数据，加场馆需要一次部署）。

---

## 给会本地构建的贡献者

可选自检：

```bash
npm install
npm run gen:seatmaps   # 为新场馆生成占位坐席图
npm run typecheck      # 类型检查
npm run build          # 构建（会把 data/venues/*.json 打进 bundle）
```

`data/venues/*.json` 会被 [`src/data/venues.ts`](src/data/venues.ts) 的 `import.meta.glob` 在构建时全量打包，供客户端 Fuse.js 搜索。`data/_venue-template.json` 放在 `data/venues/` **之外**，因此不会被打进 bundle，也不会被 demo 种子脚本收录——它纯粹是给你抄的样板。

---

## 还有问题？

- 只想提名字：用站内「想看的场馆」页。
- 数据填写疑问：在 PR 里 @ 维护者，或开一个 Issue。
- 站点代码以 Apache 2.0 协议开源；你贡献的场馆**元数据**（名字、坐席图占位、sub-map 标签）随站点代码一同以 Apache 2.0 协议提供。用户上传的**照片内容**则是 CC BY-NC 4.0（与本教程无关，见 [README](README.md) 与 [LICENSE](LICENSE)）。

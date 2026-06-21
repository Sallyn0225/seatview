# SeatView

[![Website](https://img.shields.io/badge/Website-seat.genchi.top-brightgreen)](https://seat.genchi.top) [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE) [![CI](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml/badge.svg)](https://github.com/Sallyn0225/seatview/actions/workflows/ci.yml)

<!-- README-I18N:START -->

[简体中文](./README.md) | [English](./README.en.md) | **日本語** | [한국어](./README.ko.md)

<!-- README-I18N:END -->

> 抽選・チケット争奪戦・開演前の座席確認——その席から実際に何が見えるのかを確かめよう。
> リアル座席ビュー · 真实视角图集 —— 内部コードネーム `seatmap-real`

**SeatView** は、日本（および一部海外）のライブ会場の**リアルな座席ビュー写真**を集約します。ユーザーは会場公式の座席表上に自分の席をマークし、その位置から撮った実写を投稿。他のユーザーは座席表のマーカーをクリックすると、その席のリアルな視界を Lightbox でプレビューでき、1 枚の視点写真への直接リンクも共有できます。抽選やチケット争奪、開演前の座席確認のときに、より賢い判断ができます。

閲覧、投稿、匿名評価はすべて **SeatView への登録不要**です。投稿は IP レート制限 + Cloudflare Turnstile で不正利用を防ぎ、評価は会場 + ソルト付き IP hash で重複排除とレート制限を行います。コメントは giscus で GitHub Discussions に接続します。スタック全体が Cloudflare のみで動作します：Workers（SSR + 静的アセット）+ D1 + KV + R2。

公開サイト 👉 **[seat.genchi.top](https://seat.genchi.top)**

[プレビュー](#プレビュー) · [機能](#機能) · [技術スタック](#技術スタック) · [クイックスタート](#クイックスタート) · [デプロイ](#cloudflare-へのデプロイ) · [仕組み](#仕組み) · [プロジェクト構成](#プロジェクト構成) · [コントリビュート](#コントリビュート)

## プレビュー

> 以下のスクリーンショットは公開サイト **[seat.genchi.top](https://seat.genchi.top)**（簡体字中国語 · ライトテーマ）から取得したものです。

<p align="center">
  <img src="docs/screenshots/hero.png" alt="SeatView トップページ" width="88%">
</p>

コア体験はたった二段階——**座席表で席をタップ → その席のリアルな視界を見る**：

<table>
  <tr>
    <th width="50%">① 座席表のマーカー</th>
    <th width="50%">② リアルビュー Lightbox</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/seatmap.png" alt="会場の座席表とマーカー" width="100%"></td>
    <td><img src="docs/screenshots/lightbox.jpg" alt="座席のリアルビュー Lightbox" width="100%"></td>
  </tr>
  <tr>
    <td>会場公式の座席表（複数レイヤー / 複数エリアの切り替え対応）上で、他ユーザーがマークした座席ポイントを表示。隣接するポイントは自動で集約し件数を表示します。</td>
    <td>マーカーやサムネイルをクリックすると、その席の実写 + 座席番号 / テキスト説明を Lightbox で表示します。</td>
  </tr>
</table>

<table>
  <tr>
    <th width="40%">③ 会場の全投稿（ウォーターフォール）</th>
    <th width="32%">見たい会場（クラウドソーシング一時置き場）</th>
    <th width="28%">ダークテーマ</th>
  </tr>
  <tr>
    <td><img src="docs/screenshots/album.jpg" alt="会場投稿のウォーターフォール" width="100%"></td>
    <td><img src="docs/screenshots/staging.png" alt="見たい会場の一時置き場" width="100%"></td>
    <td><img src="docs/screenshots/seatmap-dark.png" alt="ダークテーマの座席表" width="100%"></td>
  </tr>
  <tr>
    <td>座席表の下に、その会場のリアルビュー投稿の全件を masonry ウォーターフォールで表示します。</td>
    <td>見たい会場がない？名前を書けば、他のユーザーが +1 で賛同できます。</td>
    <td>ライト / ダーク / システム追従の三段階テーマ切り替え。</td>
  </tr>
</table>

## 機能

- **都道府県別ブラウズ** —— 左側の会場ツリーは日本の行政区画でグループ化・折りたたみ可能。Fuse.js のクライアントサイドあいまい検索で、中国語 / 日本語 / ローマ字のエイリアスもヒットします。
- **座席表マーキング** —— 会場公式の座席表（複数レイヤー / 複数エリアの tag 切り替え対応）上で、他ユーザーがマークした座席ポイントを表示。隣接するポイントは自動で集約し件数を表示します。
- **リアルビュー Lightbox** —— マーカーをクリックすると、その席の実写 + 座席番号 / テキスト説明を表示。Lightbox は現在の写真を `?photo=` として URL に反映し、共有ボタンで会場 / エリア文脈つきの deep link をコピーできます。下部のウォーターフォールでその会場の全投稿を表示します。
- **会場の投稿数表示** —— 会場タイトル下に現在のエリアと会場全体の写真数を表示し、座席図エリアの切り替えや新規投稿後に即時同期します。
- **会場コメントと評価** —— 会場タイトル付近の控えめな入口に総合点 / 評価数を表示し、右側のドロワーを開きます。上部は匿名4項目の 1〜5 星評価（見やすさ、音響、周辺の便利さ、アクセス。再評価はスコア変更）、下部は `venue:<id>` に厳密マッピングされた giscus コメントで、言語パスや座席表タブをまたいで同じ議論を共有します。
- **登録不要の投稿** —— マーク（全画面ズームで精密に配置するモードあり）→ 画像選択 → クライアント側で WebP に圧縮（EXIF 除去）→ HMAC ticket の二段階コミット。未完了のステップはインライン案内で誘導し、全工程で IP レート制限 + Turnstile による不正対策。
- **多言語 i18n** —— `/zh` `/ja` `/en` `/ko` の 4 プレフィックスルーティング、ルート直下 `/` は `Accept-Language` で自動リダイレクト（`zh` / `ja` は対等な二軸、`en` / `ko` はアクセシビリティのための翻訳レイヤー）。
- **会場のクラウドソーシング** —— サイト内「見たい会場」一時置き場で +1（公開票数 + 日次レート制限 + 同名の重複排除）、または GitHub PR で会場 JSON を直接投稿。
- **メンテナー管理画面** —— `/admin` は Cloudflare Access のエッジ認証で保護、投稿のソフト削除に対応。

## 技術スタック

| レイヤー | 採用 | 説明 |
|---|---|---|
| フロントエンドフレームワーク | **Astro 6.4** + React 19.2 Islands | 大部分は静的化、インタラクティブなコンポーネントは React |
| デプロイアダプター | **`@astrojs/cloudflare` v13.7** | Astro 6 は Cloudflare Pages 非対応となり、全面的に **Workers** を使用（SSR + 静的アセットを同一 Worker で） |
| ランタイムバインディング | **`import { env } from "cloudflare:workers"`** | Astro v6 は `Astro.locals.runtime.env` を削除。型は `src/env.d.ts` の `Cloudflare.Env` を参照 |
| スタイリング | **Tailwind v4.3**（Vite プラグイン `@tailwindcss/vite`） | 独立した `tailwind.config` なし。デザイントークンは `src/styles/global.css` に記述 |
| UI コンポーネント | **すべて手書き**（`DESIGN.md` のトークンに準拠） | `components.json` は存在するが、UI は shadcn/ui 生成ではない |
| アイコン | `lucide-react` | |
| 検索 | **Fuse.js**（クライアント側で全件） | 会場 ≤ 200、バンドル内の全件検索でレイテンシゼロ |
| データベース | **Cloudflare D1 + Drizzle ORM** | photos / staging / photo corrections / venue ratings。schema は `src/server/db/schema.ts`。マイグレーションは `drizzle-kit generate` |
| レート制限 | **Cloudflare KV**（`RATE_LIMIT`） | 投稿、一時置き場、座席番号修正、評価の日次カウントとクールダウン。TTL で自動失効 |
| 画像ストレージ | **Cloudflare R2**（`BUCKET`） | **バインディング直接書き込み**、presigned URL ではない |
| ボット対策 | **Cloudflare Turnstile** | 二段階：フロントエンド token → バックエンド siteverify |
| コメント | **giscus** + `@giscus/react` | GitHub Discussions を使用。コメントドロワーは初回オープン時だけ遅延ロードし、サイトのライト / ダークテーマに追従 |
| 匿名評価 | **D1 集約テーブル** + React island | 4項目の 1〜5 星評価。`venue_id + ip_hash` で重複排除し、`venue_rating_agg` から次元別集約を読み取り |
| 画像処理 | `browser-image-compression` | 長辺 1920px / WebP / EXIF 除去 / 約 500KB |
| Lightbox | `yet-another-react-lightbox` v3 | |
| ウォーターフォール | `react-photo-album`（masonry） | |
| 座席表のズーム | **`react-zoom-pan-pinch` v4.0** | `setTransform` / `resetTransform` でプログラム的にズーム |
| i18n | **Astro 組み込み i18n ルーティング** | `/zh` `/ja` `/en` `/ko` の 4 プレフィックス、ルート直下は 302 |
| ULID | **自前実装**（`src/server/id.ts`） | `ulid` パッケージは不使用（import 時に `detectPrng()` が workerd で例外を投げるため） |

> [!NOTE]
> いくつかの実装は初期の PRD / research の記述と**意図的に異なります**。本リポジトリを正とします。詳しくは [仕組み → 主要な実装上のトレードオフ](#主要な実装上のトレードオフ) を参照。

## クイックスタート

> [!IMPORTANT]
> 前提：**Node ≥ 22.12**（Astro 6 の要件）。

```bash
# 1. 依存関係をインストール
npm install

# 2. ローカルのシークレットを準備（デフォルトは Cloudflare ドキュメントの「常に通過」Turnstile テスト key、オフラインで動作確認可能）
cp .dev.vars.example .dev.vars

# 3.（任意）imageUrl が .svg を指す新規会場のプレースホルダー座席表を生成。収録済み会場の座席表はリポジトリに同梱
npm run gen:seatmaps

# 4. ローカル D1 を初期化（マイグレーション適用）
npm run db:migrate:local

# 5. デモのマーカーを生成して投入（座席表 / ウォーターフォール / Lightbox にコンテンツを用意）
npm run gen:seed && npm run db:seed:local

# 6. 開発サーバーを起動
npm run dev        # ページ開発専用、最速の HMR（D1/KV/R2 バインディングと API は利用不可）
# または
npm run preview    # フル機能（バインディング + API、miniflare 経由）
```

> [!TIP]
> UI を書く・スタイルを調整するには `npm run dev`（最速）。アップロード / 一時置き場 / 管理画面など Cloudflare バインディングに依存する機能を連携テストするには `npm run preview`（先に `astro build`、続いて `wrangler dev` がビルド成果物 `dist/server/wrangler.json` を指し、ローカルでは miniflare が D1/KV/R2 を提供）。

> [!WARNING]
> ルートの `wrangler.jsonc` に対して直接 `wrangler dev` を実行**しないでください**（つまり `-c` なし）：ルート設定はバインディングを宣言するだけで `main`/`assets` が**ありません**。そのためビルド成果物ではなくアダプターのソースエントリが起動し、すべてのページの SSR がリテラルの `[object Object]` を返してしまいます。`npm run preview` / `npm run deploy` は正しい設定を指すよう既に設定済みです。

<details>
<summary><b>すべての npm スクリプト</b></summary>

| コマンド | 役割 |
|---|---|
| `npm run dev` | `astro dev`、ページのホットリロード |
| `npm run build` | `astro build`、Workers バンドルを `dist/` に出力 |
| `npm run preview` | `astro build` 後に `wrangler dev -c dist/server/wrangler.json`、ビルド成果物 + バインディングをローカルで実行 |
| `npm test` | `node --experimental-strip-types --test`、純粋ロジックの単体テストを実行 |
| `npm run typecheck` | `astro check`、型チェック |
| `npm run format` / `format:check` | Prettier フォーマット / チェック（CI は `format:check`） |
| `npm run db:generate` | `drizzle-kit generate`、schema からマイグレーションを生成 |
| `npm run db:migrate:local` / `:prod` | `wrangler d1 migrations apply`（ローカル / リモート） |
| `npm run gen:seatmaps` | プレースホルダー座席表 SVG を生成 |
| `npm run gen:seed` | デモのシード SQL を生成 |
| `npm run db:seed:local` | デモのシードをローカル D1 に投入 |
| `npm run cf-typegen` | `wrangler types`、バインディングの型を生成 |
| `npm run deploy` | `astro build && wrangler deploy -c dist/server/wrangler.json` |

</details>

## Cloudflare へのデプロイ

リソースを一度作成し、返ってきた id を `wrangler.jsonc` に記入してから、マイグレーション + デプロイします。

```bash
# 1. D1 / KV / R2 リソースを作成
wrangler d1 create seatmap-real
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create SESSION       # Astro CF アダプターは SESSION KV バインディングを要求します
wrangler r2 bucket create seatmap-images

# 2. 返ってきた実際の id を wrangler.jsonc に記入（プレースホルダー YOUR_*）：
#    d1_databases[0].database_id、kv_namespaces[].id（RATE_LIMIT と SESSION に各 1 つ）

# 3. リモート D1 にマイグレーションを適用
npm run db:migrate:prod

# 4. Turnstile の本番シークレットを設定（リポジトリにコミットしないこと）
wrangler secret put TURNSTILE_SECRET_KEY
#    site key は .env.production の PUBLIC_TURNSTILE_SITE_KEY に記入（さらに wrangler.jsonc の vars と同期）

# 5. giscus コメントを設定（公開リソース id、シークレットではありません）
#    GitHub repo で Discussions を有効化し、giscus App をインストールし、
#    "Venue Comments" category を作成してから PUBLIC_GISCUS_REPO / REPO_ID /
#    CATEGORY / CATEGORY_ID を .env.production に記入し、wrangler.jsonc vars と同期

# 6. デプロイ
npm run deploy
```

> [!NOTE]
> **自動デプロイ (CD)**：設定が完了すると、`main` への push で GitHub Actions が自動的にビルドして Cloudflare にデプロイします（`.github/workflows/ci.yml`。すべてのチェックが通った後にのみデプロイ。Actions タブの「Run workflow」から手動トリガーも可能）。上記の `npm run deploy` は初回 / ローカルでの手動デプロイ用です。
>
> **一度きりの設定**：Cloudflare ダッシュボードで「Edit Cloudflare Workers」テンプレートを使って API トークンを作成し（Account = 自分のアカウント、Zone = `genchi.top`。custom domain で権限不足になる場合は Zone → DNS: Edit も追加）、GitHub repo → Settings → Secrets and variables → Actions でリポジトリシークレット `CLOUDFLARE_API_TOKEN` として追加します。
>
> CD は D1 マイグレーションを実行**しません**。schema を変更した場合は引き続き手動で `npm run db:migrate:prod` を実行してください。

> [!IMPORTANT]
> **メンテナー管理画面**（`/admin` + `/api/admin/*`）は **Cloudflare Access (Zero Trust)** によりエッジで保護されます：ダッシュボードの Zero Trust → Access → Applications で `/*/admin` と `/api/admin/*` をカバーする self-hosted アプリを新規作成し、Allow → メンテナーのメールアドレスの policy を 1 つ追加します。Access が認証後に `Cf-Access-Authenticated-User-Email` を注入し、Worker はそのヘッダーを信頼します（`src/server/admin-auth.ts`）。匿名トラフィックは Worker に到達しません。本番では admin の環境変数は**不要**です。本番で `DEV_ADMIN_EMAIL` を**絶対に設定しないでください**——SSO ゲートウェイを迂回してしまいます。

> [!NOTE]
> 本リポジトリには既に日本 / 一部海外の会場データ 71 件（`public/seatmaps/` 下に座席図画像 85 点）+ デモのマーカーが含まれています。本番の実際のマーカーは、ユーザーがアップロードフローを通じて D1 に書き込みます。`npm run db:migrate:prod` の再実行が必要なのは DB schema を変更したときだけで、フロントエンドのみの変更にマイグレーションは不要です。

## 仕組み

### アップロードフロー（バインディング直接書き込み + HMAC ticket）

presigned URL によるクライアント直接アップロードではなく、**sign + commit の二段階**方式を採用し、D1 への書き込みが偽造不可能であること、そしてローカルの miniflare R2 だけで全工程を通しで動作確認できること（S3 認証情報 / バケット CORS 不要）を保証します：

1. **クライアント**が座席表上でマークし画像を選択、`browser-image-compression` で約 500KB の WebP に圧縮（長辺 ≤ 1920、EXIF 除去）し、Turnstile を通過して token を取得します。
2. **`POST /api/upload/sign`** —— Worker が Turnstile + 30s クールダウン + 1 日 10 件の上限（KV、キーは**ハッシュ化した IP**）を検証し、書き込む全フィールド（venue / sub-map / 座標 / 座席番号 / `ip_hash` / `image_key` / 有効期限）をバインドした **HMAC ticket** を発行します。この時点では日次クォータを**消費しません**。
3. **`POST /api/upload/commit`**（multipart）—— クライアントが ticket + WebP のバイト列を送り返します。Worker は HMAC + 有効期限を再検証し、バイト列を `BUCKET` バインディング経由で R2 に書き込み、続いて**ticket 内のフィールドを使って**（リクエストボディは信頼しない）D1 に挿入し、最後にようやく日次クォータを消費 + 30s クールダウンを開始します。
4. ネットワークエラー / 5xx は自動リトライし、同じ ticket（および消費済みの Turnstile token）を再利用します。4xx（ticket 期限切れなど）はリトライしません。

ソフト削除：メンテナーが `/admin` で画像を削除すると、D1 が `deleted_at` をセット（公開クエリは `deleted_at IS NULL` でフィルタし、マーカー / カードが即座に消えます）し、R2 オブジェクトはゴミ箱に残るため復元できます。ゴミ箱の「完全に削除」だけが、R2 オブジェクトと D1 行をどちらも物理削除します。

### 環境変数 / バインディング

| 名称 | 種別 | 用途 | ローカル | 本番 |
|---|---|---|---|---|
| `DB` | D1 | photos + staging_venues + photo_correction_requests + venue_ratings / venue_rating_agg | miniflare 自動 | `wrangler.jsonc` に実際の `database_id` を記入 |
| `BUCKET` | R2 | アップロード画像のストレージ（バインディング直接書き込み） | miniflare 自動 | `wrangler.jsonc`（`bucket_name`） |
| `RATE_LIMIT` | KV | IP レート制限のカウント + クールダウン（TTL）。投稿 / 一時置き場 / 座席番号修正 / 評価を含む | miniflare 自動 | `wrangler.jsonc` に実際の KV id を記入 |
| `SESSION` | KV | Astro CF アダプターの session API が要求するバインディング（実際には書き込まない） | miniflare 自動 | `wrangler.jsonc` に実際の KV id を記入 |
| `TURNSTILE_SECRET_KEY` | シークレット | バックエンド siteverify / HMAC ticket / IP-hash salt | `.dev.vars`（テスト secret） | `wrangler secret put` |
| `PUBLIC_TURNSTILE_SITE_KEY` | 公開 var | フロントエンド Turnstile widget | `.env.development` | `.env.production`（+ `wrangler.jsonc` vars のランタイムコピー） |
| `PUBLIC_R2_BASE_URL` | 公開 var | アップロード画像 URL を組み立てる。空 → 同一オリジン `/r2/<key>` にフォールバック | `.env.development`（空） | `.env.production`（r2.dev / カスタムドメイン） |
| `PUBLIC_SITE_URL` | 公開 var | サイトのベース URL | `http://localhost:4321` | 本番ドメイン |
| `PUBLIC_GISCUS_REPO` / `PUBLIC_GISCUS_REPO_ID` / `PUBLIC_GISCUS_CATEGORY` / `PUBLIC_GISCUS_CATEGORY_ID` | 公開 var | giscus の会場コメント設定。必須値が空の場合、コメント欄は未開放状態を表示し、第三者リソースを読み込みません | `.env.development` | `.env.production`（+ `wrangler.jsonc` vars のランタイムコピー） |
| `DEV_ADMIN_EMAIL` | ローカル限定 | メンテナー identity の mock（Access エッジがない場合） | `.dev.vars`（任意のメール） | **絶対に設定しない**（Cloudflare Access を使用） |

> [!NOTE]
> `PUBLIC_*` は Vite が**ビルド時**に `.env*` からクライアントバンドルへインライン化します（islands は `import.meta.env.PUBLIC_*` で読み取り）——`wrangler.jsonc` の `vars`（これは Worker ランタイムにのみ届く）**からではありません**。2 つの仕組み、2 つのファイルなので、Turnstile / R2 / giscus などの公開値は同期を忘れないでください。R2 アップロードに S3 presigned 認証情報（`R2_ACCESS_KEY_ID` など）は**不要**で、Worker は `BUCKET` バインディング経由で直接書き込みます。

### 会場コメントと匿名評価

会場タイトル付近には `VenueComments` island がマウントされ、初期状態では控えめな入口（平均点 / 評価数 / コメント）だけを表示します。`@giscus/react` はドロワーを初めて開いたときだけ動的 import されます。閉じるときはアンマウントせず非表示にするため、再オープン時に giscus iframe が再読み込みされません。giscus は `mapping="specific"` + `term="venue:<id>"` を使うので、同じ会場は言語パスや座席表タブをまたいで 1 つの GitHub Discussions スレッドを共有します。テーマはシステムテーマではなく、サイトの `html.dark` クラスに追従します。`PUBLIC_GISCUS_CATEGORY_ID` など必須値が空の場合、コメント欄は「まだ利用できません」状態だけを表示し、第三者 script / iframe は読み込みません。

匿名評価は `POST /api/rating` を通り、静的な `venue.id` と完全な4項目 1〜5 星評価（見やすさ、音響、周辺の便利さ、アクセス）のみを受け付けます。単発評価で challenge を出さないため Turnstile は使いませんが、`TURNSTILE_SECRET_KEY` は IP-hash salt として使います。D1 では `venue_id + ip_hash` ごとに `venue_ratings` を 1 行だけ保存し、再評価は新規票ではなく4項目スコアの変更になります。`venue_rating_agg` は次元別の count / sum 集約を保持し、評価行と集約の更新は 1 つの `db.batch` で行います。会場ページ SSR はこの集約行だけを読み、失敗しても空の評価状態へ静かにフォールバックします。KV は「1 日に新規評価した異なる会場数」だけを制限し、既存スコアの変更では消費しません。

### 写真数と共有 deep link

会場ページは SSR で現在の sub-map の初期写真と、`listVenuePhotoCounts` が返すエリア別集計を読み込みます。タイトル下の `VenuePhotoCountLine` は、単一マップの会場では合計枚数を、複数マップの会場では「現在のエリア / 会場全体」の枚数を表示します。sub-map の再取得や投稿成功時には、`seatview:photo-count-change` イベントでこの行を同期します。

Lightbox の共有 URL は写真 ULID を主とします：`/{locale}/v/{venueId}?tab=<subMapId>&photo=<photoId>`。`?photo=` がある場合のみ主キー検索を行い、写真が公開状態で現在の会場に属することを確認し、写真自身の sub-map で古い `?tab=` を上書きしてから Lightbox を自動で開きます。解決できないリンクは通常の会場ページにフォールバックします。閲覧中は Lightbox が `replaceState` で `?photo=` を更新し、共有ボタンは現在の言語の短い文面 + canonical link をコピーします。

### 主要な実装上のトレードオフ

<details>
<summary>初期の PRD / research の記述と<b>意図的に異なる</b>いくつかの実装（展開）</summary>

1. **UI は全て手書き**で、shadcn/ui 生成ではありません。
2. **アップロードは「バインディング直接書き込み」**（クライアントが圧縮済み WebP を Worker に送り、Worker が `BUCKET` バインディングで R2 に書き込む）で、HMAC ticket の sign + commit 二段階で偽造を防ぎます——presigned URL によるクライアントの R2 直接アップロード**ではありません**。
3. **Astro v6** はバインディングの読み取りに `import { env } from "cloudflare:workers"` を使い、`Astro.locals.runtime.env` ではありません。
4. **Tailwind v4 Vite プラグイン**、独立した config はなく、トークンは `src/styles/global.css`。
5. **`react-zoom-pan-pinch` v4.0**、集約点の中心合わせを明示的に保つため `setTransform` / `resetTransform` を使用。
6. **ULID は自前実装**（`crypto.getRandomValues`）で、`ulid` パッケージは不使用。
7. R2 バインディング名は **`BUCKET`**、レート制限 KV は **`RATE_LIMIT`**、さらに **`SESSION`** KV があります（アダプターが自動で有効化する session API に必要。SeatView はアカウントシステムを持たず session を実際には書きませんが、バインディングは解決可能である必要があります）。admin は **Cloudflare Access**（`Cf-Access-Authenticated-User-Email` ヘッダー）を使用し、ローカルでは `.dev.vars` の `DEV_ADMIN_EMAIL` で mock します。
8. **giscus コメントは任意の公開設定**です。`PUBLIC_GISCUS_*` が欠けている場合は第三者リソースを読み込まず、設定済みなら `venue:<id>` で GitHub Discussions に紐づけます。
9. **会場評価は匿名の D1 集約**です。`venue_ratings` は各 `venue_id + ip_hash` の現在4項目スコアを保存し、`venue_rating_agg` は表示用の集約を保存します。GitHub reaction やソーシャルな「いいね」ではありません。
10. **写真 deep link は `?photo=<ulid>` を正とします**：`?tab=` は読みやすさとフォールバック用だけです。サーバーが写真行から sub-map を導くため、子座席図のリネームでも共有済みリンクは壊れません。

</details>

## プロジェクト構成

```
seatmap-real/
├── astro.config.mjs          # Astro 6.4 + CF Workers アダプター + Tailwind v4.3 Vite プラグイン + i18n
├── wrangler.jsonc            # CF バインディング：DB(D1) / BUCKET(R2) / RATE_LIMIT,SESSION(KV) / vars
├── drizzle.config.ts         # drizzle-kit：schema から ./migrations へマイグレーション生成
├── data/
│   ├── venues/<id>.json      # 静的な会場メタデータ、ビルド時にバンドルへ
│   └── _venue-template.json  # コントリビューター用テンプレート（venues/ の外、バンドル / シード対象外）
├── migrations/               # D1 マイグレーション：photos / staging_votes / photo_corrections / venue_ratings
├── seeds/0001_demo_photos.sql# ローカルのデモマーカー（スクリプト生成、ローカル限定）
├── scripts/                  # プレースホルダー座席表 / デモシード / 座標マイグレーションのスクリプト
├── public/seatmaps/<id>/...  # メンテナーがアップロードした座席表 WebP（公式の著作権画像ではない）
└── src/
    ├── env.d.ts              # Cloudflare.Env バインディング型
    ├── middleware.ts         # ルート 302 / locale 解決 / admin ガード
    ├── i18n/                 # locale 設定 + 文言
    ├── data/                 # 会場ツリー + 47 都道府県
    ├── types/venue.ts        # Venue / SubMap / Photo / StagingVenue の単一の真実の源
    ├── lib/                  # レイヤー横断の契約 + クライアントユーティリティ（upload / staging / venue-rating / share / photo counts を含む）
    ├── server/               # Worker 側：db / photos / staging / ratings / rate-limit / turnstile / id / admin-auth / r2
    ├── pages/                # api/（upload·staging·rating·admin·photos）+ [lang]/（ホーム / 会場ページ / 一時置き場 / 管理画面 / プライバシー / 利用規約）
    └── styles/global.css     # Tailwind v4.3 + デザイントークン（OKLCH ニュートラル + 朱赤アクセント）
```

## コントリビュート

新しい会場を追加するルートは 2 つあります：

1. **名前だけ報告** —— サイト内「見たい会場」ページ（`/zh/staging`、`/ja/staging`）で、他のユーザーが +1 できます。最も手軽です。
2. **自分でデータを追加** —— GitHub Fork → `data/venues/<id>.json` を編集 → PR。非エンジニア向けの図解チュートリアルやフィールド説明は **[CONTRIBUTING.md](CONTRIBUTING.md)** に、テンプレートは [`data/_venue-template.json`](data/_venue-template.json) にあります。

> [!IMPORTANT]
> サイトのコードは **Apache 2.0** でオープンソース化されています（[LICENSE](LICENSE) 参照）。ユーザーがアップロードした写真とそのメタデータは **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)** で共有されます——アップロード前に必須の同意チェックボックスがあります。**著作権のある公式座席表は提出しないでください**：`public/seatmaps/` 以下はすべてメンテナーがアップロードした座席表です（公式の著作権画像ではありません）。

## 謝辞

- **技術コミュニティ** —— 開発中の交流と協力をいただいた [Linux Do](https://linux.do/) コミュニティに感謝します。
- **座席表の参考元** —— 会場の座席表は [LiveKiti](https://livekiti.com/) と [LiveWalker](https://www.livewalker.com/) を参考に校正しました。

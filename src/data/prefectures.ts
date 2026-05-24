// Japanese first-level administrative divisions (47 prefectures) grouped into
// regions, plus an "overseas" bucket — the spine of the left venue tree (R1).
//
// Static reference data authored in the Git repo (like venue metadata, ADR-1).
// Region grouping and ordering follow the conventional Japanese geographic
// regions used by event databases such as eventernote.com/places (R1.3):
// 北海道 → 東北 → 関東 → 中部 → 近畿 → 中国 → 四国 → 九州・沖縄 → 海外.
//
// Each prefecture carries a slug that MUST match the `prefecture` field on
// Venue records (see data/venues/*.json). Labels are bilingual (zh/jp) so the
// venue tree can switch with the UI language (R9.4); user-uploaded content is
// never translated, but these admin-division names are first-party data.

import type { Locale } from "@/i18n/config";

/** A single prefecture (or the synthetic "overseas" bucket). */
export interface Prefecture {
  /** url-safe slug, matches Venue.prefecture, e.g. "kanagawa" / "overseas". */
  slug: string;
  /** Simplified Chinese label. */
  label_zh: string;
  /** Japanese label. */
  label_jp: string;
}

/** A geographic region grouping several prefectures (a tree branch). */
export interface Region {
  /** url-safe slug, e.g. "kanto" / "overseas". */
  slug: string;
  label_zh: string;
  label_jp: string;
  prefectures: Prefecture[];
}

function pref(slug: string, label_zh: string, label_jp: string): Prefecture {
  return { slug, label_zh, label_jp };
}

/**
 * All regions in canonical display order. Covers 北海道 + 46 都府県 + 海外.
 * The 47 prefectures total: Hokkaido (1) + Tohoku (6) + Kanto (7) + Chubu (9)
 * + Kinki (7) + Chugoku (5) + Shikoku (4) + Kyushu-Okinawa (8) = 47.
 */
export const regions: Region[] = [
  {
    slug: "hokkaido",
    label_zh: "北海道",
    label_jp: "北海道",
    prefectures: [pref("hokkaido", "北海道", "北海道")],
  },
  {
    slug: "tohoku",
    label_zh: "东北",
    label_jp: "東北",
    prefectures: [
      pref("aomori", "青森县", "青森県"),
      pref("iwate", "岩手县", "岩手県"),
      pref("miyagi", "宫城县", "宮城県"),
      pref("akita", "秋田县", "秋田県"),
      pref("yamagata", "山形县", "山形県"),
      pref("fukushima", "福岛县", "福島県"),
    ],
  },
  {
    slug: "kanto",
    label_zh: "关东",
    label_jp: "関東",
    prefectures: [
      pref("ibaraki", "茨城县", "茨城県"),
      pref("tochigi", "栃木县", "栃木県"),
      pref("gunma", "群马县", "群馬県"),
      pref("saitama", "埼玉县", "埼玉県"),
      pref("chiba", "千叶县", "千葉県"),
      pref("tokyo", "东京都", "東京都"),
      pref("kanagawa", "神奈川县", "神奈川県"),
    ],
  },
  {
    slug: "chubu",
    label_zh: "中部",
    label_jp: "中部",
    prefectures: [
      pref("niigata", "新潟县", "新潟県"),
      pref("toyama", "富山县", "富山県"),
      pref("ishikawa", "石川县", "石川県"),
      pref("fukui", "福井县", "福井県"),
      pref("yamanashi", "山梨县", "山梨県"),
      pref("nagano", "长野县", "長野県"),
      pref("gifu", "岐阜县", "岐阜県"),
      pref("shizuoka", "静冈县", "静岡県"),
      pref("aichi", "爱知县", "愛知県"),
    ],
  },
  {
    slug: "kinki",
    label_zh: "近畿",
    label_jp: "近畿",
    prefectures: [
      pref("mie", "三重县", "三重県"),
      pref("shiga", "滋贺县", "滋賀県"),
      pref("kyoto", "京都府", "京都府"),
      pref("osaka", "大阪府", "大阪府"),
      pref("hyogo", "兵库县", "兵庫県"),
      pref("nara", "奈良县", "奈良県"),
      pref("wakayama", "和歌山县", "和歌山県"),
    ],
  },
  {
    slug: "chugoku",
    label_zh: "中国",
    label_jp: "中国",
    prefectures: [
      pref("tottori", "鸟取县", "鳥取県"),
      pref("shimane", "岛根县", "島根県"),
      pref("okayama", "冈山县", "岡山県"),
      pref("hiroshima", "广岛县", "広島県"),
      pref("yamaguchi", "山口县", "山口県"),
    ],
  },
  {
    slug: "shikoku",
    label_zh: "四国",
    label_jp: "四国",
    prefectures: [
      pref("tokushima", "德岛县", "徳島県"),
      pref("kagawa", "香川县", "香川県"),
      pref("ehime", "爱媛县", "愛媛県"),
      pref("kochi", "高知县", "高知県"),
    ],
  },
  {
    slug: "kyushu-okinawa",
    label_zh: "九州 · 冲绳",
    label_jp: "九州・沖縄",
    prefectures: [
      pref("fukuoka", "福冈县", "福岡県"),
      pref("saga", "佐贺县", "佐賀県"),
      pref("nagasaki", "长崎县", "長崎県"),
      pref("kumamoto", "熊本县", "熊本県"),
      pref("oita", "大分县", "大分県"),
      pref("miyazaki", "宫崎县", "宮崎県"),
      pref("kagoshima", "鹿儿岛县", "鹿児島県"),
      pref("okinawa", "冲绳县", "沖縄県"),
    ],
  },
  {
    slug: "overseas",
    label_zh: "海外",
    label_jp: "海外",
    prefectures: [pref("overseas", "海外", "海外")],
  },
];

/** Flat list of every prefecture across all regions (including overseas). */
export const prefectures: Prefecture[] = regions.flatMap((r) => r.prefectures);

/** Look up a single prefecture by slug. */
export function getPrefecture(slug: string): Prefecture | undefined {
  return prefectures.find((p) => p.slug === slug);
}

/** Locale-appropriate prefecture label (R9.4). */
export function prefectureName(prefecture: Prefecture, locale: Locale): string {
  return locale === "ja" ? prefecture.label_jp : prefecture.label_zh;
}

/** Locale-appropriate region label (R9.4). */
export function regionName(region: Region, locale: Locale): string {
  return locale === "ja" ? region.label_jp : region.label_zh;
}

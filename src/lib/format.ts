// Locale-aware display formatters for user-uploaded photo metadata.
//
// Used by the photo grid (caption) and the Lightbox (footer strip + detail
// sheet). Kept pure and import-safe on the server so SSR and client agree on
// the rendered shape. User-authored content (seat_label / event_name /
// description) is NEVER reformatted here (R9.5) — these helpers only touch the
// machine fields (createdAt epoch, ISO performance date).

import type { Locale } from "@/i18n/config";

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Locale-appropriate absolute date. zh/ja render 年月日 literals
 * (shape-lightbox.md §8); en/ko (accessibility layer) use their own forms.
 */
function formatYMD(y: number, m: number, d: number, locale: Locale): string {
  switch (locale) {
    case "en":
      return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
    case "ko":
      return `${y}년 ${m}월 ${d}일`;
    default:
      return `${y}年${m}月${d}日`; // zh + ja
  }
}

/**
 * Relative "time ago" for the upload timestamp, shown only inside the Lightbox
 * detail sheet (shape-lightbox.md §8: "相对时间, 不显示精确时间戳").
 *   zh: 刚刚 / N 分钟前 / …       ja: たった今 / N分前 / …
 *   en: just now / N minutes ago  ko: 방금 / N분 전 / …
 * `now` is injectable for deterministic tests.
 */
export function relativeTime(
  createdAtMs: number,
  locale: Locale,
  now: number = Date.now(),
): string {
  const diffSec = Math.max(0, Math.round((now - createdAtMs) / 1000));
  const min = Math.floor(diffSec / 60);
  const hour = Math.floor(diffSec / 3600);
  const day = Math.floor(diffSec / 86400);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);

  if (locale === "ja") {
    if (diffSec < 60) return "たった今";
    if (hour < 1) return `${min}分前`;
    if (day < 1) return `${hour}時間前`;
    if (month < 1) return `${day}日前`;
    if (year < 1) return `${month}か月前`;
    return `${year}年前`;
  }
  if (locale === "en") {
    const plural = (n: number, unit: string) =>
      `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    if (diffSec < 60) return "just now";
    if (hour < 1) return plural(min, "minute");
    if (day < 1) return plural(hour, "hour");
    if (month < 1) return plural(day, "day");
    if (year < 1) return plural(month, "month");
    return plural(year, "year");
  }
  if (locale === "ko") {
    if (diffSec < 60) return "방금";
    if (hour < 1) return `${min}분 전`;
    if (day < 1) return `${hour}시간 전`;
    if (month < 1) return `${day}일 전`;
    if (year < 1) return `${month}개월 전`;
    return `${year}년 전`;
  }
  if (diffSec < 60) return "刚刚";
  if (hour < 1) return `${min} 分钟前`;
  if (day < 1) return `${hour} 小时前`;
  if (month < 1) return `${day} 天前`;
  if (year < 1) return `${month} 个月前`;
  return `${year} 年前`;
}

/**
 * Absolute upload timestamp for the `<time>` title / SR text (machine-readable
 * fallback alongside the relative string).
 */
export function absoluteDate(epochMs: number, locale: Locale): string {
  const d = new Date(epochMs);
  return formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate(), locale);
}

/**
 * Localize an ISO performance date (`YYYY-MM-DD`) for display in the footer
 * strip + detail sheet. Returns `null` when the input is empty/unparsable so
 * callers can drop the row entirely (no "—" placeholder).
 */
export function performanceDate(
  iso: string | null,
  locale: Locale,
): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return formatYMD(Number(y), Number(m), Number(d), locale);
}

/**
 * Fill `{key}` placeholders in an i18n template. Trims collapsing whitespace so
 * an alt string like `{label} {date} {event}` stays clean when optional fields
 * are empty.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

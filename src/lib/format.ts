// Locale-aware display formatters for user-uploaded photo metadata.
//
// Used by the photo grid (caption) and the Lightbox (footer strip + detail
// sheet). Kept pure and import-safe on the server so SSR and client agree on
// the rendered shape. User-authored content (seat_label / event_name /
// description) is NEVER reformatted here (R9.5) — these helpers only touch the
// machine fields (createdAt epoch, ISO performance date).

import type { Locale } from "@/i18n/config";

/**
 * Relative "time ago" for the upload timestamp, shown only inside the Lightbox
 * detail sheet (shape-lightbox.md §8: "相对时间, 不显示精确时间戳").
 *   zh: 刚刚 / N 分钟前 / N 小时前 / N 天前 / N 个月前 / N 年前
 *   ja: たった今 / N分前 / N時間前 / N日前 / Nか月前 / N年前
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
  if (diffSec < 60) return "刚刚";
  if (hour < 1) return `${min} 分钟前`;
  if (day < 1) return `${hour} 小时前`;
  if (month < 1) return `${day} 天前`;
  if (year < 1) return `${month} 个月前`;
  return `${year} 年前`;
}

/**
 * Absolute upload timestamp for the `<time>` title / SR text (machine-readable
 * fallback alongside the relative string). Both locales use 年月日 literals
 * (shape-lightbox.md §8).
 */
export function absoluteDate(epochMs: number, locale: Locale): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // zh and ja both render 年月日 (the shape brief specifies identical literals).
  void locale;
  return `${y}年${m}月${day}日`;
}

/**
 * Localize an ISO performance date (`YYYY-MM-DD`) for display in the footer
 * strip + detail sheet. Both locales render 年月日 (shape-lightbox.md §8).
 * Returns `null` when the input is empty/unparsable so callers can drop the row
 * entirely (no "—" placeholder, shape-lightbox.md "empty optional fields").
 */
export function performanceDate(
  iso: string | null,
  locale: Locale,
): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  void locale;
  return `${y}年${Number(m)}月${Number(d)}日`;
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

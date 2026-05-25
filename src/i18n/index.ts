// i18n entry: message lookup + locale-aware helpers usable from both Astro
// pages and React islands.
import type { Venue } from "@/types";
import { defaultLocale, type Locale } from "./config";
import zh, { type Messages } from "./locales/zh";
import ja from "./locales/ja";
import en from "./locales/en";
import ko from "./locales/ko";

const messages: Record<Locale, Messages> = { zh, ja, en, ko };

/** Get the full message bundle for a locale. */
export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[defaultLocale];
}

/**
 * Render the locale-appropriate venue display name (R9.4).
 * zh → name_zh, ja → name_jp, en → name_romaji, ko → name_jp.
 * en/ko are an accessibility layer with no dedicated name field, so they fall
 * back to the romaji (en) / Japanese (ko) proper noun. User-authored content
 * (seat label / event / description) is never translated (R9.5).
 */
export function venueName(venue: Venue, locale: Locale): string {
  switch (locale) {
    case "ja":
    case "ko":
      return venue.name_jp;
    case "en":
      return venue.name_romaji;
    default:
      return venue.name_zh;
  }
}

/**
 * Render the locale-appropriate sub-map tab label. Sub-maps carry no romaji
 * field, so every non-zh locale falls back to the Japanese label.
 */
export function subMapLabel(
  subMap: Pick<Venue["subMaps"][number], "label_zh" | "label_jp">,
  locale: Locale,
): string {
  return locale === "zh" ? subMap.label_zh : subMap.label_jp;
}

export { defaultLocale, type Locale } from "./config";
export type { Messages } from "./locales/zh";

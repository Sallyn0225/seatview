// i18n entry: message lookup + locale-aware helpers usable from both Astro
// pages and React islands.
import type { Venue } from "@/types";
import { defaultLocale, type Locale } from "./config";
import zh, { type Messages } from "./locales/zh";
import ja from "./locales/ja";

const messages: Record<Locale, Messages> = { zh, ja };

/** Get the full message bundle for a locale. */
export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[defaultLocale];
}

/**
 * Render the locale-appropriate venue display name.
 * zh → name_zh, ja → name_jp (R9.4). User-authored content is never translated.
 */
export function venueName(venue: Venue, locale: Locale): string {
  return locale === "ja" ? venue.name_jp : venue.name_zh;
}

/**
 * Render the locale-appropriate sub-map tab label.
 */
export function subMapLabel(
  subMap: Pick<Venue["subMaps"][number], "label_zh" | "label_jp">,
  locale: Locale,
): string {
  return locale === "ja" ? subMap.label_jp : subMap.label_zh;
}

export { defaultLocale, type Locale } from "./config";
export type { Messages } from "./locales/zh";

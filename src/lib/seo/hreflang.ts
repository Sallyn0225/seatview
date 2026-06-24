// hreflang alternates for the locale-prefixed routing (R2.4).
//
// Every route is locale-prefixed (`/zh/...`, `/ja/...`, ...). Given any one
// locale's pathname we derive the equivalent URL in every other locale so the
// <head> can advertise the full set of language alternates (plus x-default,
// which points at the default locale per Google's guidance). Pure + dependency
// -free so it unit-tests without a request.

import { locales, defaultLocale, isLocale, type Locale } from "@/i18n/config";
import {
  localeAlternatesForConfig,
  stripLocale as stripLocaleForConfig,
  type Alternate,
} from "@/lib/seo/hreflang-core";

/** BCP-47 hreflang value per locale. Simplified Chinese is `zh-Hans`. */
export const HREFLANG: Record<Locale, string> = {
  zh: "zh-Hans",
  ja: "ja",
  en: "en",
  ko: "ko",
};

/**
 * Strip the leading `/{locale}` segment from a pathname, returning the
 * locale-independent remainder (always starting with `/`). A pathname without a
 * known locale prefix is returned unchanged.
 *   "/zh/v/k-arena" → "/v/k-arena"   "/ja/" → "/"   "/zh" → "/"
 */
export function stripLocale(pathname: string): string {
  return stripLocaleForConfig(pathname, isLocale);
}

/**
 * All hreflang alternates for a given (locale-prefixed) pathname, including the
 * `x-default` entry that points at the default locale.
 */
export function localeAlternates(
  pathname: string,
  siteUrl: string | URL,
): Alternate[] {
  return localeAlternatesForConfig(pathname, siteUrl, {
    locales,
    defaultLocale,
    hreflang: HREFLANG,
    isLocale,
  });
}

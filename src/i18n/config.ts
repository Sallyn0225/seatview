// i18n configuration. Keep `locales` in sync with astro.config.mjs `i18n`.

export const locales = ["zh", "ja"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh";

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}

/** Narrow a route param to a Locale, falling back to the default. */
export function asLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/**
 * Pick the best locale from a raw `Accept-Language` header. Falls back to the
 * default locale when nothing matches. Used by the root `/` redirect.
 */
export function resolveLocaleFromAcceptLanguage(
  header: string | null,
): Locale {
  if (!header) return defaultLocale;
  // Parse "ja,en-US;q=0.9,zh;q=0.8" into ordered base language tags.
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      const q = qPart ? Number.parseFloat(qPart) : 1;
      return { tag: (tag ?? "").toLowerCase(), q: Number.isNaN(q) ? 1 : q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("zh")) return "zh";
  }
  return defaultLocale;
}

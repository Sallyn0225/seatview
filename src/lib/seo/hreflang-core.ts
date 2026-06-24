export interface HreflangConfig<Locale extends string> {
  locales: readonly Locale[];
  defaultLocale: Locale;
  hreflang: Record<Locale, string>;
  isLocale: (value: string | undefined) => value is Locale;
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/**
 * Strip the leading `/{locale}` segment from a pathname, returning the
 * locale-independent remainder (always starting with `/`). A pathname without a
 * known locale prefix is returned unchanged.
 */
export function stripLocale<Locale extends string>(
  pathname: string,
  isLocale: HreflangConfig<Locale>["isLocale"],
): string {
  const segments = pathname.split("/");
  if (isLocale(segments[1])) {
    const rest = segments.slice(2).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname;
}

/** Build the locale-prefixed pathname for `rest` (the stripLocale output). */
function localePath<Locale extends string>(loc: Locale, rest: string): string {
  return rest === "/" ? `/${loc}/` : `/${loc}${rest}`;
}

/**
 * All hreflang alternates for a given pathname, including the `x-default` entry
 * that points at the configured default locale.
 */
export function localeAlternatesForConfig<Locale extends string>(
  pathname: string,
  siteUrl: string | URL,
  config: HreflangConfig<Locale>,
): Alternate[] {
  const rest = stripLocale(pathname, config.isLocale);
  const alternates: Alternate[] = config.locales.map((loc) => ({
    hreflang: config.hreflang[loc],
    href: new URL(localePath(loc, rest), siteUrl).href,
  }));
  alternates.push({
    hreflang: "x-default",
    href: new URL(localePath(config.defaultLocale, rest), siteUrl).href,
  });
  return alternates;
}

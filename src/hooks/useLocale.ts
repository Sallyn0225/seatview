import { useMemo } from "react";
import { getMessages, type Locale, type Messages } from "@/i18n";

interface UseLocaleResult {
  locale: Locale;
  /** Message bundle for the active locale. */
  t: Messages;
}

/**
 * React-island locale helper. The active locale is passed down from the Astro
 * page (resolved from the URL prefix) rather than read from the DOM, so islands
 * stay deterministic during SSR/hydration.
 */
export function useLocale(locale: Locale): UseLocaleResult {
  const t = useMemo(() => getMessages(locale), [locale]);
  return { locale, t };
}

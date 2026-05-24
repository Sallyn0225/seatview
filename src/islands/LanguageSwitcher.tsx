import { useEffect, useState } from "react";
import { locales, type Locale } from "@/i18n/config";
import { STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  locale: Locale;
}

const LABELS: Record<Locale, string> = { zh: "中", ja: "あ" };
const FULL: Record<Locale, string> = { zh: "简体中文", ja: "日本語" };

/**
 * Locale switch (R9.3): swaps the `/zh/` ↔ `/ja/` path prefix while keeping the
 * rest of the path (and the `?tab=` query) intact, so switching language on a
 * venue page stays on that venue. The chosen locale is also persisted.
 *
 * Touch target ≥44px overall (PRODUCT.md a11y: language switcher must be easy
 * to hit). Rendered as a compact segmented `中 | あ`.
 */
export default function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const [href, setHref] = useState<Record<Locale, string>>({
    zh: "/zh/",
    ja: "/ja/",
  });

  // Build per-locale hrefs that preserve the current path + query.
  useEffect(() => {
    const { pathname, search } = window.location;
    const segments = pathname.split("/");
    const next = {} as Record<Locale, string>;
    for (const target of locales) {
      const copy = [...segments];
      // segments[0] is "" (leading slash); segments[1] is the locale prefix.
      copy[1] = target;
      next[target] = copy.join("/") + search;
    }
    setHref(next);
  }, []);

  return (
    <div
      className="border-border inline-flex items-center rounded-md border p-0.5"
      role="group"
      aria-label={locale === "ja" ? "言語" : "语言"}
    >
      {locales.map((target, index) => {
        const active = target === locale;
        return (
          <span key={target} className="flex items-center">
            {index > 0 && (
              <span aria-hidden="true" className="text-border select-none">
                |
              </span>
            )}
            <a
              href={href[target]}
              hrefLang={target}
              aria-label={FULL[target]}
              aria-current={active ? "true" : undefined}
              onClick={() => writeStorage(STORAGE_KEYS.locale, target)}
              className={cn(
                "relative flex h-7 min-w-9 items-center justify-center rounded-sm px-1 text-sm",
                // Expand the clickable area to ≥44×44px (DESIGN.md a11y) via a
                // transparent overlay, without enlarging the compact visible chip.
                "before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                "transition-colors duration-150",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {LABELS[target]}
            </a>
          </span>
        );
      })}
    </div>
  );
}

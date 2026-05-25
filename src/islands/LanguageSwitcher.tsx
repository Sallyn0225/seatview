import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n";
import { STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  locale: Locale;
}

/** Compact glyph shown on the trigger. */
const SHORT: Record<Locale, string> = {
  zh: "中",
  ja: "あ",
  en: "EN",
  ko: "한",
};
/** Full endonym shown in the menu + aria. */
const FULL: Record<Locale, string> = {
  zh: "简体中文",
  ja: "日本語",
  en: "English",
  ko: "한국어",
};

/**
 * Locale switch (R9.3): a compact dropdown that swaps the `/<locale>/` path
 * prefix while keeping the rest of the path (and the `?tab=` query) intact, so
 * switching language on a venue page stays on that venue. The chosen locale is
 * persisted. A dropdown (rather than a segmented row) keeps the top nav
 * uncrowded as the locale count grows past two.
 *
 * Hand-rolled popover in the Flat-Folio style (hairline border, no shadow) —
 * the project does not wire radix/shadcn. Trigger + items are ≥44px tall
 * (DESIGN.md a11y: the language switcher must be easy to hit).
 */
export default function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const t = getMessages(locale);
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState<Record<Locale, string>>(() => {
    const init = {} as Record<Locale, string>;
    for (const l of locales) init[l] = `/${l}/`;
    return init;
  });
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Close on outside click / Esc (inline popover, no modal).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.nav.language}: ${FULL[locale]}`}
        className={cn(
          "border-border text-foreground inline-flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-md border px-2 text-sm",
          // Expand the clickable area to ≥44×44px (DESIGN.md a11y) via a
          // transparent overlay, without enlarging the compact visible chip.
          "before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
          "transition-colors duration-150 hover:bg-secondary",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <span>{SHORT[locale]}</span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t.nav.language}
          className="border-border bg-popover absolute right-0 top-full z-40 mt-1 min-w-[8rem] rounded-md border py-1"
        >
          {locales.map((target) => {
            const active = target === locale;
            return (
              <a
                key={target}
                href={href[target]}
                hrefLang={target}
                role="menuitem"
                aria-current={active ? "true" : undefined}
                onClick={() => writeStorage(STORAGE_KEYS.locale, target)}
                className={cn(
                  "flex h-11 items-center justify-between gap-3 px-3 text-sm",
                  "focus-visible:ring-ring focus-visible:ring-inset focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span>{FULL[target]}</span>
                {active && (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

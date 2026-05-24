import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { subMapLabel } from "@/i18n";
import type { SubMap } from "@/types";
import {
  resolveInitialSubMapId,
  setActiveSubMap,
  SUBMAP_QUERY_PARAM,
} from "@/lib/submap";
import { cn } from "@/lib/utils";

interface SubMapTabsProps {
  locale: Locale;
  subMaps: SubMap[];
  /** Sub-map id requested via `?tab=` at SSR time (already validated). */
  initialSubMapId?: string;
}

/**
 * Flat sub-map tags (R3.3). Multi-image venues (e.g. K Arena's L1/L3/L5/L7)
 * render a horizontal row of tags with the current one underlined; switching
 * syncs `?tab=<sub-map>` and broadcasts to the seatmap / grid islands. Single
 * sub-map venues render nothing — the page shows that one chart directly.
 *
 * Tabs are separated by a centered Hairline-Ash `·` (shape-venue-page §11).
 * Switching is instant — no transition animation (shape-venue-page §7).
 */
export default function SubMapTabs({
  locale,
  subMaps,
  initialSubMapId,
}: SubMapTabsProps) {
  const [active, setActive] = useState<string | undefined>(() =>
    resolveInitialSubMapId(subMaps, initialSubMapId),
  );
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Reconcile with the URL after mount in case the page was reached without an
  // explicit prop (defensive; keeps the underline matching the query).
  useEffect(() => {
    const requested =
      new URL(window.location.href).searchParams.get(SUBMAP_QUERY_PARAM) ??
      undefined;
    const resolved = resolveInitialSubMapId(subMaps, requested);
    if (resolved) setActive(resolved);
  }, [subMaps]);

  if (subMaps.length <= 1) return null;

  function onSelect(subMapId: string) {
    if (subMapId === active) return;
    setActive(subMapId);
    setActiveSubMap(subMapId);
  }

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label={locale === "ja" ? "座席図を切り替え" : "切换坐席图"}
      className="-mx-1 flex items-center overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {subMaps.map((subMap, index) => {
        const isActive = subMap.id === active;
        return (
          <div key={subMap.id} className="flex shrink-0 items-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className="text-border mx-3 select-none"
              >
                ·
              </span>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(subMap.id)}
              className={cn(
                "border-b-2 pb-1 text-sm whitespace-nowrap transition-colors duration-150",
                "focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none",
                isActive
                  ? "border-foreground text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {subMapLabel(subMap, locale)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

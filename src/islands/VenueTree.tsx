import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { venueName } from "@/i18n";
import {
  buildVenueTree,
  type RegionNode,
} from "@/data/venues";
import { prefectureName, regionName } from "@/data/prefectures";
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface VenueTreeProps {
  locale: Locale;
  /** Currently open venue id, so its row reads as active. */
  activeVenueId?: string;
  /**
   * Called when the user picks a venue. The desktop tree lets the default
   * link navigation happen; the mobile drawer passes a handler to also close
   * the drawer after selection.
   */
  onSelect?: (venueId: string) => void;
}

const expandedKey = STORAGE_KEYS.treeExpanded;

/** Read the persisted set of expanded region/prefecture slugs. */
function readExpanded(): Set<string> | null {
  const raw = readStorage(expandedKey);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((s): s is string => typeof s === "string"));
    }
  } catch {
    /* ignore malformed persisted value */
  }
  return null;
}

/**
 * Left venue tree (R1): regions → prefectures → venues.
 *
 * MVP default-expand (shape-venue-page decision 3): only populated divisions
 * are emitted by buildVenueTree(), and on first visit they all start expanded
 * so the first paint is never empty. The expanded set persists to localStorage
 * so a returning user keeps their collapse choices within the session feel.
 */
export default function VenueTree({
  locale,
  activeVenueId,
  onSelect,
}: VenueTreeProps) {
  const tree: RegionNode[] = useMemo(() => buildVenueTree(), []);

  // Every populated region + prefecture starts expanded (shape decision 3).
  const allSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const r of tree) {
      slugs.add(r.region.slug);
      for (const p of r.prefectures) slugs.add(p.prefecture.slug);
    }
    return slugs;
  }, [tree]);

  // Start from the all-expanded default for a stable SSR/first paint, then
  // reconcile with any persisted choice after mount (avoids hydration drift).
  const [expanded, setExpanded] = useState<Set<string>>(allSlugs);

  useEffect(() => {
    const persisted = readExpanded();
    if (persisted) setExpanded(persisted);
  }, []);

  const toggle = useCallback((slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      writeStorage(expandedKey, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return (
    <nav aria-label={locale === "ja" ? "会場ツリー" : "场馆树"}>
      <ul className="space-y-0.5">
        {tree.map((regionNode) => {
          const regionSlug = regionNode.region.slug;
          const regionOpen = expanded.has(regionSlug);
          return (
            <li key={regionSlug}>
              <DisclosureButton
                level="region"
                open={regionOpen}
                label={regionName(regionNode.region, locale)}
                onToggle={() => toggle(regionSlug)}
              />
              {regionOpen && (
                <ul className="mt-0.5 space-y-0.5 pl-3">
                  {regionNode.prefectures.map((prefNode) => {
                    const prefSlug = prefNode.prefecture.slug;
                    const prefOpen = expanded.has(prefSlug);
                    return (
                      <li key={prefSlug}>
                        <DisclosureButton
                          level="prefecture"
                          open={prefOpen}
                          label={prefectureName(prefNode.prefecture, locale)}
                          onToggle={() => toggle(prefSlug)}
                        />
                        {prefOpen && (
                          <ul className="mt-0.5 space-y-px pl-4">
                            {prefNode.venues.map((venue) => {
                              const active = venue.id === activeVenueId;
                              return (
                                <li key={venue.id}>
                                  <a
                                    href={`/${locale}/v/${venue.id}`}
                                    aria-current={active ? "page" : undefined}
                                    onClick={() => onSelect?.(venue.id)}
                                    className={cn(
                                      "flex items-center gap-1.5 rounded-sm py-1.5 pr-2 pl-2 text-sm",
                                      "transition-colors duration-150",
                                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                                      active
                                        ? "bg-secondary font-medium text-foreground"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                                    )}
                                  >
                                    {active && (
                                      <Star
                                        className="text-accent size-3 shrink-0"
                                        fill="currentColor"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="truncate">
                                      {venueName(venue, locale)}
                                    </span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface DisclosureButtonProps {
  level: "region" | "prefecture";
  open: boolean;
  label: string;
  onToggle: () => void;
}

function DisclosureButton({
  level,
  open,
  label,
  onToggle,
}: DisclosureButtonProps) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center gap-1 rounded-sm py-1.5 pr-2 pl-1 text-left",
        "transition-colors duration-150",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "hover:bg-secondary/60",
        level === "region"
          ? "text-foreground text-sm font-medium"
          : "text-muted-foreground text-sm",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

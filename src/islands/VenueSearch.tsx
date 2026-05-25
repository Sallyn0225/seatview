import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Fuse, { type FuseResult } from "fuse.js";
import { Search, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { venues } from "@/data/venues";
import { venueName } from "@/i18n";
import type { Venue } from "@/types";
import { cn } from "@/lib/utils";
import { VENUE_FUSE_OPTIONS, venueExtendedQuery } from "@/lib/venue-fuse";

interface VenueSearchProps {
  locale: Locale;
}

const MAX_RESULTS = 8;

/**
 * Top venue search (R2). Client-side full-set Fuse.js search — every venue is
 * already in the bundle (ADR-1), so there is zero network latency.
 *
 * Space-separated multi-keyword (R2.5): "K Arena 横滨" and "横滨 K Arena" must
 * both hit K Arena Yokohama. With useExtendedSearch we join the tokens with
 * Fuse's AND operator (a single space already means AND in extended search,
 * but building it explicitly keeps the intent obvious and order-independent).
 */
export default function VenueSearch({ locale }: VenueSearchProps) {
  const { t } = useLocale(locale);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const fuse = useMemo(() => new Fuse(venues, VENUE_FUSE_OPTIONS), []);

  const results: FuseResult<Venue>[] = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    // Each whitespace-separated token must match (extended-search AND).
    return fuse.search(venueExtendedQuery(trimmed)).slice(0, MAX_RESULTS);
  }, [fuse, query]);

  // Reset the active descendant whenever the candidate list changes.
  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Close the candidate popover on outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Power-user "/" focuses the search box (desktop), unless already typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (venueId: string) => {
      window.location.href = `/${locale}/v/${venueId}`;
    },
    [locale],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (results.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
      } else if (event.key === "Enter") {
        const picked = results[activeIndex] ?? results[0];
        if (picked) {
          event.preventDefault();
          go(picked.item.id);
        }
      }
    },
    [results, activeIndex, go],
  );

  const hasQuery = query.trim().length > 0;
  const showPopover = open && hasQuery;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPopover}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showPopover && activeIndex >= 0
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
          aria-label={t.search.label}
          placeholder={t.search.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => hasQuery && setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "border-border bg-background h-9 w-full rounded-md border py-2 pr-8 pl-8 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:outline-none",
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label={t.search.clear}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {showPopover && (
        <ul
          id={listboxId}
          role="listbox"
          className="border-border bg-popover absolute z-50 mt-1 w-full overflow-hidden rounded-md border py-1"
        >
          {results.length === 0 ? (
            <li
              role="presentation"
              className="text-muted-foreground px-3 py-2 text-sm"
            >
              {t.search.noResults}
            </li>
          ) : (
            results.map((result, index) => {
              const v = result.item;
              const active = index === activeIndex;
              return (
                <li
                  key={v.id}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    // Prevent input blur before navigation fires.
                    e.preventDefault();
                    go(v.id);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 px-3 py-2",
                    active ? "bg-secondary" : "bg-transparent",
                  )}
                >
                  <span className="text-foreground truncate text-sm">
                    {venueName(v, locale)}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {v.name_romaji}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

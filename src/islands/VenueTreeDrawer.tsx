import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Menu, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { STORAGE_KEYS, readStorage, writeStorage } from "@/lib/storage";
import VenueTree from "./VenueTree";
import { cn } from "@/lib/utils";

interface VenueTreeDrawerProps {
  locale: Locale;
  activeVenueId?: string;
}

/**
 * Mobile / tablet venue-tree drawer (R10.3). The tree is a left drawer covering
 * ~85% of the screen with a narrow tap-to-close strip on the right. Picking a
 * venue closes the drawer (the link then navigates). Esc closes; focus is
 * trapped to the panel while open; body scroll is locked.
 *
 * shadcn's Sheet isn't installed yet, so this is a minimal, accessible drawer
 * that follows the same overlay-is-ink-not-shadow rule (Flat Folio).
 */
export default function VenueTreeDrawer({
  locale,
  activeVenueId,
}: VenueTreeDrawerProps) {
  const { t } = useLocale(locale);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoringScrollRef = useRef(false);
  const userScrolledRef = useRef(false);

  const rememberScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    writeStorage(STORAGE_KEYS.treeScrollTop, String(scroller.scrollTop));
  }, []);

  const handleScroll = useCallback(() => {
    if (restoringScrollRef.current) return;
    userScrolledRef.current = true;
    rememberScroll();
  }, [rememberScroll]);

  const restoreScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    restoringScrollRef.current = true;

    // Tie the guard reset to whichever fires first: the programmatic scroll
    // event from `scroller.scrollTop = X`, or a RAF fallback for the case
    // where the assignment doesn't actually change the value (browser elides
    // the event). Safari/under-load can deliver the scroll event AFTER a
    // bare RAF callback, which would let `handleScroll` flip
    // `userScrolledRef` even though the user never touched the drawer.
    const finishRestoring = () => {
      let done = false;
      const clear = () => {
        if (done) return;
        done = true;
        scroller.removeEventListener("scroll", clear);
        restoringScrollRef.current = false;
      };
      scroller.addEventListener("scroll", clear, { once: true });
      requestAnimationFrame(clear);
    };

    const rawScrollTop = readStorage(STORAGE_KEYS.treeScrollTop);
    const scrollTop = rawScrollTop ? Number.parseInt(rawScrollTop, 10) : 0;

    if (
      userScrolledRef.current &&
      Number.isFinite(scrollTop) &&
      scrollTop > 0
    ) {
      scroller.scrollTop = scrollTop;
      finishRestoring();
      return;
    }

    const activeLink = activeVenueId
      ? scroller.querySelector<HTMLElement>("[data-venue-tree-active-row]")
      : null;

    if (activeLink) {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = activeLink.getBoundingClientRect();
      const centeredTop =
        activeRect.top -
        scrollerRect.top +
        scroller.scrollTop -
        scroller.clientHeight / 2 +
        activeLink.clientHeight / 2;
      const maxScrollTop = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight,
      );

      scroller.scrollTop = Math.min(Math.max(0, centeredTop), maxScrollTop);
      rememberScroll();
      finishRestoring();
      return;
    }

    if (Number.isFinite(scrollTop) && scrollTop > 0) {
      scroller.scrollTop = scrollTop;
    }

    finishRestoring();
  }, [activeVenueId, rememberScroll]);

  useLayoutEffect(() => {
    if (!open) return;
    restoreScroll();
  }, [open, restoreScroll]);

  const close = useCallback(() => {
    rememberScroll();
    setOpen(false);
    triggerRef.current?.focus();
  }, [rememberScroll]);

  // Esc to close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the panel.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.tree.open}
        aria-expanded={open}
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          "text-foreground hover:bg-secondary/60 transition-colors duration-150",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Ink overlay (not a shadow). */}
          <div
            className="absolute inset-0 bg-foreground/55"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.tree.title}
            tabIndex={-1}
            className="bg-card relative flex h-full w-[85%] max-w-sm flex-col outline-none"
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <span className="text-foreground text-sm font-medium">
                {t.tree.title}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label={t.tree.close}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div
              ref={scrollerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-2 py-3"
            >
              <VenueTree
                locale={locale}
                activeVenueId={activeVenueId}
                onReady={restoreScroll}
                onSelect={() => close()}
              />
            </div>
            <StagingLink locale={locale} t={t.tree.stagingPrompt} />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Staging-area entry at the bottom of the tree (cross-brief contract from
 * shape-staging-page §11): the most context-fitting place to prompt "the venue
 * you want isn't listed — request it". Visually distinct from tree rows.
 */
function StagingLink({ locale, t }: { locale: Locale; t: string }) {
  return (
    <div className="border-border border-t px-2 py-3">
      <a
        href={`/${locale}/staging`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring block rounded-sm px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        {t} →
      </a>
    </div>
  );
}

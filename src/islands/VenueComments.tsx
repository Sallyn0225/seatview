// Venue comments + anonymous rating entry (task 06-10-giscus).
//
// One self-contained island mounted in the venue title area: a quiet entry
// chip ("★4.3 · 12 人评分 · 评论", demoted small text per prd — never a big
// authoritative star bar) that opens a right drawer (full-screen sheet on
// mobile, matching UploadSheet's container family). Drawer top = the 5-star
// anonymous rating control (no login, score change = UPSERT, optimistic
// update with rollback); below = the giscus comments frame.
//
// Lazy mount (prd "懒挂载"): nothing giscus-related — not even the
// @giscus/react bundle — loads until the drawer first opens (dynamic import +
// `loading="lazy"`). Closing HIDES the drawer instead of unmounting it so the
// giscus iframe never reloads on reopen. While the giscus categoryId is not
// configured yet (PUBLIC_GISCUS_CATEGORY_ID empty), the comments block renders
// a quiet "not open yet" line and loads no giscus resources at all.
//
// Theme: follows the SITE's light/dark class on <html> via a MutationObserver
// (NOT giscus `preferred_color_scheme`, which tracks the OS and would desync
// from the site's tri-state ThemeToggle). @giscus/react propagates the theme
// prop change to the iframe via postMessage without reloading it.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { MessageSquare, Star, X } from "lucide-react";
import type { GiscusProps } from "@giscus/react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import LoadFailure from "@/components/LoadFailure";
import { fillTemplate } from "@/lib/format";
import {
  applyOptimisticRating,
  ratingAverage,
  RATING_MAX,
  RATING_MIN,
  type VenueRatingSummaryDto,
} from "@/lib/venue-rating";
import { RatingError, submitRating } from "@/lib/venue-rating-client";
import { cn } from "@/lib/utils";

/** giscus widget UI language per site locale (zh → zh-CN, the rest map 1:1). */
const GISCUS_LANG: Record<Locale, GiscusProps["lang"]> = {
  zh: "zh-CN",
  ja: "ja",
  en: "en",
  ko: "ko",
};

// Build-time giscus config, inlined by Vite from .env.development /
// .env.production (frontend/index.md PUBLIC_* contract — wrangler.jsonc `vars`
// never reach the client bundle). Non-secret by definition.
const GISCUS_REPO: string = import.meta.env.PUBLIC_GISCUS_REPO ?? "";
const GISCUS_REPO_ID: string = import.meta.env.PUBLIC_GISCUS_REPO_ID ?? "";
const GISCUS_CATEGORY: string = import.meta.env.PUBLIC_GISCUS_CATEGORY ?? "";
const GISCUS_CATEGORY_ID: string =
  import.meta.env.PUBLIC_GISCUS_CATEGORY_ID ?? "";

function isRepoSlug(value: string): value is `${string}/${string}` {
  return /^[^/]+\/[^/]+$/.test(value);
}

/** Narrowed repo slug, or null when the env var is absent/malformed. */
const giscusRepo = isRepoSlug(GISCUS_REPO) ? GISCUS_REPO : null;

/** All four giscus ids present → the comments frame may load. */
const giscusConfigured =
  giscusRepo !== null &&
  GISCUS_REPO_ID.length > 0 &&
  GISCUS_CATEGORY.length > 0 &&
  GISCUS_CATEGORY_ID.length > 0;

const STARS = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => RATING_MIN + i,
);

const SHEET_ANIM_MS = 250;

type RatingErrorKey = "limit" | "network" | "server";

/**
 * The site's resolved light/dark theme, kept in sync with the `dark` class on
 * <html> (written by ThemeToggle + the pre-paint script). SSR snapshot is
 * "light"; the effect corrects it before the drawer (and giscus) ever opens.
 */
function useSiteTheme(): "dark" | "light" {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark ? "dark" : "light";
}

interface VenueCommentsProps {
  locale: Locale;
  venueId: string;
  /** SSR-read aggregate (one `venue_rating_agg` row) + this viewer's score. */
  initialRating: VenueRatingSummaryDto;
}

export default function VenueComments({
  locale,
  venueId,
  initialRating,
}: VenueCommentsProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  const theme = useSiteTheme();

  // ── Drawer open state ──────────────────────────────────────────────────────
  // `everOpened` keeps the drawer MOUNTED (hidden) after the first open so the
  // giscus iframe survives close/reopen without reloading.
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openDrawer = useCallback(() => {
    setEverOpened(true);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Esc to close + body scroll lock + focus into the panel while open.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeDrawer]);

  // ── Rating state (optimistic with rollback) ────────────────────────────────
  const [summary, setSummary] = useState<VenueRatingSummaryDto>(initialRating);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingError, setRatingError] = useState<RatingErrorKey | null>(null);
  const [ratingSaved, setRatingSaved] = useState(false);

  const rate = useCallback(
    (score: number) => {
      if (ratingPending || summary.yourScore === score) return;
      const previous = summary;

      setSummary(applyOptimisticRating(previous, score));
      setRatingPending(true);
      setRatingError(null);
      setRatingSaved(false);

      submitRating(venueId, score)
        .then((res) => {
          // Reconcile to the authoritative aggregate.
          setSummary({
            count: res.ratingCount,
            sum: res.ratingSum,
            yourScore: res.yourScore,
          });
          setRatingSaved(true);
        })
        .catch((err: unknown) => {
          setSummary(previous); // roll back the optimistic state
          const code = err instanceof RatingError ? err.code : "server_error";
          setRatingError(
            code === "rate_limited_daily"
              ? "limit"
              : code === "network"
                ? "network"
                : "server",
          );
        })
        .finally(() => setRatingPending(false));
    },
    [ratingPending, summary, venueId],
  );

  // ── giscus lazy load (first open only) ─────────────────────────────────────
  const [Giscus, setGiscus] = useState<ComponentType<GiscusProps> | null>(null);
  const [giscusFailed, setGiscusFailed] = useState(false);
  const [giscusLoading, setGiscusLoading] = useState(false);
  const giscusRequestedRef = useRef(false);

  const loadGiscus = useCallback(() => {
    if (giscusRequestedRef.current) return;
    giscusRequestedRef.current = true;
    setGiscusFailed(false);
    setGiscusLoading(true);
    import("@giscus/react")
      .then((mod) => {
        setGiscus(() => mod.default);
        setGiscusLoading(false);
      })
      .catch(() => {
        // Network failure fetching the chunk — allow LoadFailure's retry to
        // re-run the import.
        giscusRequestedRef.current = false;
        setGiscusFailed(true);
        setGiscusLoading(false);
      });
  }, []);

  useEffect(() => {
    if (open && giscusConfigured) loadGiscus();
  }, [open, loadGiscus]);

  // ── Derived display ────────────────────────────────────────────────────────
  const average = ratingAverage(summary.count, summary.sum);
  const ratingErrorText =
    ratingError === "limit"
      ? t.venueComments.ratingLimit
      : ratingError === "network"
        ? t.venueComments.ratingNetworkError
        : ratingError === "server"
          ? t.venueComments.ratingServerError
          : null;

  return (
    <>
      {/* Entry chip: demoted small text, never a big star bar (prd 降权展示). */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDrawer}
        aria-label={t.venueComments.entryLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm",
          "transition-colors duration-150",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <Star
          className="size-3.5"
          aria-hidden="true"
          fill={average !== null ? "currentColor" : "none"}
        />
        <span>
          {average !== null
            ? fillTemplate(t.venueComments.entrySummary, {
                avg: average.toFixed(1),
                count: String(summary.count),
              })
            : t.venueComments.entryEmpty}
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          {t.venueComments.entryComments}
        </span>
      </button>

      {/* Drawer: mounted from the first open onward, hidden (not unmounted)
          while closed so the giscus iframe is never reloaded. */}
      {everOpened ? (
        <div
          className={cn("fixed inset-0 z-50 flex", !open && "hidden")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Ink overlay (not a shadow — a layer of ink). Click to close. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={closeDrawer}
            className="absolute inset-0 cursor-default bg-[oklch(0.15_0.008_75_/_0.55)]"
            style={
              reducedMotion || !open
                ? undefined
                : {
                    animation: `seatview-overlay-in ${SHEET_ANIM_MS}ms ease-out`,
                  }
            }
          />

          {/* Panel: full-screen sheet on mobile, 480px right drawer on md+. */}
          <div
            ref={panelRef}
            tabIndex={-1}
            className={cn(
              "bg-background border-border relative ml-auto flex h-full w-full flex-col outline-none",
              "md:w-[min(480px,80vw)] md:border-l lg:w-[480px]",
              open && !reducedMotion && "seatview-sheet-panel",
            )}
          >
            {/* Sticky header */}
            <div className="border-border bg-background sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 md:px-6">
              <h2 id={titleId} className="text-foreground text-lg font-medium">
                {t.venueComments.title}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label={t.venueComments.close}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-1 grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
              {/* ── Rating block ──────────────────────────────────────────── */}
              <section>
                <h3 className="text-foreground text-sm font-medium">
                  {t.venueComments.ratingTitle}
                </h3>
                <div
                  role="radiogroup"
                  aria-label={t.venueComments.ratingTitle}
                  className="mt-2 flex items-center"
                >
                  {STARS.map((n) => {
                    const filled =
                      summary.yourScore !== null && n <= summary.yourScore;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={summary.yourScore === n}
                        aria-label={fillTemplate(t.venueComments.starLabel, {
                          n: String(n),
                        })}
                        disabled={ratingPending}
                        onClick={() => rate(n)}
                        className={cn(
                          "grid size-11 place-items-center rounded-md",
                          "transition-colors duration-150",
                          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                          "disabled:cursor-not-allowed disabled:opacity-60",
                          filled
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Star
                          className="size-6"
                          aria-hidden="true"
                          fill={filled ? "currentColor" : "none"}
                        />
                      </button>
                    );
                  })}
                </div>

                <p className="text-muted-foreground mt-2 text-[13px]">
                  {average !== null
                    ? fillTemplate(t.venueComments.ratingSummary, {
                        avg: average.toFixed(1),
                        count: String(summary.count),
                      })
                    : t.venueComments.ratingEmpty}
                </p>
                {summary.yourScore !== null ? (
                  <p className="text-muted-foreground mt-1 text-[13px]">
                    {fillTemplate(t.venueComments.yourScore, {
                      score: String(summary.yourScore),
                    })}
                  </p>
                ) : null}

                {/* Inline status: error (rolled back) or saved. */}
                {ratingErrorText ? (
                  <p role="alert" className="text-foreground mt-2 text-[13px]">
                    {ratingErrorText}
                  </p>
                ) : ratingSaved ? (
                  <p
                    role="status"
                    className="text-muted-foreground mt-2 text-[13px]"
                  >
                    {t.venueComments.ratingSaved}
                  </p>
                ) : null}

                {/* Why-transparency (trust without accounts, PRODUCT.md #4). */}
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  {t.venueComments.ratingNote}
                </p>
              </section>

              {/* ── Comments block (giscus) ───────────────────────────────── */}
              <section className="border-border mt-6 border-t pt-5">
                <h3 className="text-foreground text-sm font-medium">
                  {t.venueComments.commentsTitle}
                </h3>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  {t.venueComments.commentsNote}
                </p>
                <div className="mt-4">
                  {!giscusConfigured || giscusRepo === null ? (
                    <p className="text-muted-foreground text-sm">
                      {t.venueComments.commentsUnavailable}
                    </p>
                  ) : giscusFailed ? (
                    <LoadFailure
                      locale={locale}
                      onRetry={loadGiscus}
                      retrying={giscusLoading}
                    />
                  ) : Giscus ? (
                    <Giscus
                      id="venue-comments"
                      repo={giscusRepo}
                      repoId={GISCUS_REPO_ID}
                      category={GISCUS_CATEGORY}
                      categoryId={GISCUS_CATEGORY_ID}
                      mapping="specific"
                      term={`venue:${venueId}`}
                      strict="1"
                      reactionsEnabled="1"
                      emitMetadata="0"
                      inputPosition="top"
                      theme={theme}
                      lang={GISCUS_LANG[locale]}
                      loading="lazy"
                    />
                  ) : (
                    <p role="status" className="text-muted-foreground text-sm">
                      {t.venueComments.commentsLoading}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

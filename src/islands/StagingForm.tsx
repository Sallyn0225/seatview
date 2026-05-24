// Staging area form + wishlist island (R6, shape-staging-page.md).
//
// "投稿箱 + 心愿名录" (staging decision 1): the submission form on top, a hairline
// rule, then the newest-first wishlist below. ONE island so the optimistic
// prepend (a fresh submission jumps to the top of the list, §7) is trivial.
//
// Visuals (Restrained): the ONLY vermilion on this page is the submit button's
// tinted fill (staging decision 3 — submitting a wish IS a contribution, same
// regalia as the upload button; distinct from the home CTA's ink outline). The
// "✓ 已收录" marker is Sumi ink, never vermilion, never green (decision 2 派生).
// Sans-only (home-explainer holds the Serif monopoly). No modal/sheet, no toast.
//
// Turnstile renders only once the input has content (§8: avoid burning a token
// on an empty page). The list first batch is SSR-injected; continuation pages
// load 50 at a time via an IntersectionObserver sentinel (no "load more" button,
// no spinner). A whole-batch failure surfaces the shared <LoadFailure> (§11).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { relativeTime, absoluteDate } from "@/lib/format";
import { STAGING_NAME_MAX, type StagingVenueDto } from "@/lib/staging";
import {
  fetchStagingPage,
  StagingError,
  submitStaging,
} from "@/lib/staging-client";
import { cn } from "@/lib/utils";
import LoadFailure from "@/components/LoadFailure";
import TurnstileWidget from "@/islands/upload/TurnstileWidget";

/** Continuation page size (text-only rows are light, shape §11). */
const LIST_BATCH = 50;
/** Sentinel triggers a fetch this far before the bottom (shape continuation). */
const SENTINEL_ROOT_MARGIN = "600px";

interface StagingFormProps {
  locale: Locale;
  /** SSR-injected first batch (newest-first), so the list paints request-free. */
  initialVenues: StagingVenueDto[];
  /** Whether more pages exist beyond the SSR batch (over-fetch probe SSR-side). */
  initialHasMore: boolean;
}

type SubmitPhase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function StagingForm({
  locale,
  initialVenues,
  initialHasMore,
}: StagingFormProps) {
  const { t } = useLocale(locale);

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitPhase>({ kind: "idle" });
  /** Disable the form for the rest of the session once the 5/day cap is hit. */
  const [dailyBlocked, setDailyBlocked] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const hasName = name.trim().length > 0;
  // Turnstile renders only when the user has typed something (§8).
  const showTurnstile = hasName && !dailyBlocked;
  const canSubmit =
    hasName &&
    turnstileToken != null &&
    submit.kind !== "submitting" &&
    !dailyBlocked;

  // ── List state ──────────────────────────────────────────────────────────
  const [venues, setVenues] = useState<StagingVenueDto[]>(initialVenues);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [listError, setListError] = useState(false);
  /** Id of the just-submitted row, so it gets a one-shot Folio Cream highlight. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const offsetRef = useRef<number>(initialVenues.length);
  const loadingRef = useRef(false);

  const loadPage = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setListError(false);
    const offset = offsetRef.current;

    fetchStagingPage(offset, LIST_BATCH)
      .then(({ venues: next, hasMore: more }) => {
        offsetRef.current = offset + next.length;
        setHasMore(more);
        setVenues((prev) => {
          const ids = new Set(prev.map((v) => v.id));
          const merged = [...prev];
          for (const v of next) if (!ids.has(v.id)) merged.push(v);
          return merged;
        });
        loadingRef.current = false;
      })
      .catch(() => {
        loadingRef.current = false;
        setListError(true);
      });
  }, [hasMore]);

  const retryList = useCallback(() => {
    if (loadingRef.current) return;
    loadPage();
  }, [loadPage]);

  // IntersectionObserver sentinel for continuous loading (no button, no spinner).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || listError) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadPage();
      },
      { rootMargin: SENTINEL_ROOT_MARGIN },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, listError, loadPage]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const errorMessage = useCallback(
    (code: StagingError["code"]): string => {
      switch (code) {
        case "turnstile_failed":
          return t.staging.turnstileError;
        case "rate_limited_daily":
          return t.staging.limitDaily;
        case "missing_name":
          return t.staging.emptyName;
        default:
          return t.staging.submitError;
      }
    },
    [t],
  );

  const doSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setSubmit({ kind: "error", message: t.staging.emptyName });
      return;
    }
    if (turnstileToken == null) return;

    setSubmit({ kind: "submitting" });
    try {
      const { venue } = await submitStaging(trimmed, turnstileToken);
      // Optimistic prepend (newest-first, R6.4) + clear + refocus (§7).
      setVenues((prev) =>
        prev.some((v) => v.id === venue.id) ? prev : [venue, ...prev],
      );
      offsetRef.current += 1;
      setHighlightId(venue.id);
      setName("");
      setTurnstileToken(null);
      setSubmit({ kind: "success" });
      requestAnimationFrame(() => nameRef.current?.focus());
    } catch (err) {
      const code = err instanceof StagingError ? err.code : "server_error";
      if (code === "rate_limited_daily") setDailyBlocked(true);
      setSubmit({ kind: "error", message: errorMessage(code) });
    }
  }, [name, turnstileToken, errorMessage, t]);

  return (
    <div>
      {/* ── 投稿箱 ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="staging-prompt">
        <h2
          id="staging-prompt"
          className="text-foreground text-2xl font-bold leading-snug"
        >
          {t.staging.promptTitle}
          <span aria-hidden="true" className="text-muted-foreground mx-2">
            ＼/
          </span>
          <span className="text-muted-foreground">
            {t.staging.promptTitleAlt}
          </span>
        </h2>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) doSubmit();
          }}
        >
          <div className="flex-1">
            <label htmlFor="staging-name" className="sr-only">
              {t.staging.inputLabel}
            </label>
            <input
              id="staging-name"
              ref={nameRef}
              type="text"
              value={name}
              maxLength={STAGING_NAME_MAX}
              disabled={dailyBlocked}
              onChange={(e) => {
                setName(e.target.value);
                // Typing clears a stale success/error so the form feels live.
                if (submit.kind !== "idle" && submit.kind !== "submitting") {
                  setSubmit({ kind: "idle" });
                }
              }}
              placeholder={t.staging.inputPlaceholder}
              className={cn(
                "bg-background text-foreground border-input h-11 w-full rounded-md border px-3 text-sm",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </div>

          {/* Submit: vermilion tinted fill (staging decision 3 — a contribution
              action). Mirrors the upload button regalia exactly. */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "inline-flex h-11 shrink-0 items-center justify-center rounded-md px-6 text-sm font-medium",
              "bg-accent/10 text-foreground border-accent/30 border",
              "transition-colors duration-150 hover:bg-accent/15 hover:border-accent/50",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {submit.kind === "submitting"
              ? t.staging.submitting
              : t.staging.submit}
          </button>
        </form>

        {/* Transparent "why only a name" copy (信任靠透明). */}
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {t.staging.transparency}
        </p>

        {/* Turnstile renders only once the input has content (§8). */}
        {showTurnstile && (
          <div className="mt-4 space-y-2">
            <TurnstileWidget onToken={setTurnstileToken} />
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t.staging.turnstileNote}
            </p>
          </div>
        )}

        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {t.staging.limitNote}
        </p>

        {/* Inline submit feedback (no toast). Success is intentionally light:
            one line, lighter weight than the upload-success page (§7). */}
        {submit.kind === "success" && (
          <p className="text-foreground mt-3 text-sm" role="status">
            {t.staging.success}
          </p>
        )}
        {submit.kind === "error" && (
          <p className="text-destructive mt-3 text-sm" role="alert">
            {submit.message}
          </p>
        )}
      </section>

      {/* Hairline rule between form and wishlist. */}
      <hr className="border-border my-12" />

      {/* ── 心愿名录 ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="staging-list">
        <h2
          id="staging-list"
          className="text-foreground text-xl font-bold leading-snug"
        >
          {t.staging.listTitle}
          <span aria-hidden="true" className="text-muted-foreground mx-2">
            ＼/
          </span>
          <span className="text-muted-foreground">{t.staging.listTitleAlt}</span>
        </h2>

        {venues.length === 0 && !listError ? (
          // Empty state — the key gentle 缝隙时刻 on a page with no photos.
          <p className="text-muted-foreground/80 mt-8 text-center text-sm">
            {t.staging.emptyBody}
          </p>
        ) : (
          <ul className="mt-6">
            {venues.map((v) => (
              <StagingRow
                key={v.id}
                venue={v}
                locale={locale}
                processedLabel={t.staging.processed}
                highlight={v.id === highlightId}
              />
            ))}
          </ul>
        )}

        {/* Continuation: sentinel when more pages remain + the shared LoadFailure
            on a whole-batch failure (continuation does not auto-retry on its own;
            the user taps retry — same component used across the app, §4). */}
        {listError ? (
          <LoadFailure
            locale={locale}
            onRetry={retryList}
            className="mt-6 rounded-md"
          />
        ) : hasMore ? (
          <div ref={sentinelRef} className="h-px" aria-hidden="true" />
        ) : venues.length > 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            {t.staging.end}
          </p>
        ) : null}
      </section>

      {/* GitHub high-bar contribution channel (R13.2 / R13.4). One transparent
          line; the two channels stay distinct (name-only here, add-data there). */}
      <p className="mt-12 text-sm">
        <a
          href="https://github.com/Sallyn0225/seatview"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {t.staging.githubChannel} ↗
        </a>
      </p>
    </div>
  );
}

/* ── Wishlist row ───────────────────────────────────────────────────────── */

interface StagingRowProps {
  venue: StagingVenueDto;
  locale: Locale;
  processedLabel: string;
  /** Just-submitted row → one-shot Folio Cream highlight that fades out (§7). */
  highlight?: boolean;
}

/**
 * One wishlist entry: venue name (user verbatim) + relative submit date, and a
 * Sumi "✓ 已收录" marker when processed. The row is NOT a link (these venues do
 * not exist yet — no /v/[id] to jump to, §4) so it carries no hover/focus/click
 * affordance and stays out of the Tab order. A freshly-submitted row briefly
 * lights with Folio Cream then fades (reduced-motion → instant via global CSS).
 */
function StagingRow({
  venue,
  locale,
  processedLabel,
  highlight = false,
}: StagingRowProps) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!highlight) return;
    const el = rowRef.current;
    if (!el) return;
    el.style.backgroundColor = "var(--card)";
    const raf = requestAnimationFrame(() => {
      el.style.transition = "background-color 600ms ease-out";
      el.style.backgroundColor = "transparent";
    });
    return () => cancelAnimationFrame(raf);
  }, [highlight]);

  const relative = relativeTime(venue.createdAt, locale);
  const absolute = absoluteDate(venue.createdAt, locale);

  return (
    <li
      ref={rowRef}
      className="border-border flex flex-col gap-1 border-b py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
    >
      <span className="text-foreground text-sm break-words">{venue.name}</span>
      <span className="flex shrink-0 items-baseline gap-3">
        <time
          dateTime={new Date(venue.createdAt).toISOString()}
          title={absolute}
          className="text-muted-foreground text-xs [font-variant-numeric:tabular-nums]"
        >
          {relative}
        </time>
        {venue.processed && (
          // Sumi ink ✓ — never vermilion, never green (decision 2 派生).
          <span className="text-foreground inline-flex items-center gap-1 text-xs">
            <span aria-hidden="true">✓</span>
            {processedLabel}
          </span>
        )}
      </span>
    </li>
  );
}

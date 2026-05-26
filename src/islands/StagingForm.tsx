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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse, { type Expression } from "fuse.js";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { venues as collectedVenues } from "@/data/venues";
import { venueName } from "@/i18n";
import type { Venue } from "@/types";
import { relativeTime, absoluteDate } from "@/lib/format";
import {
  STAGING_NAME_MAX,
  type StagingNameDto,
  type StagingVenueDto,
} from "@/lib/staging";
import {
  fetchStagingNames,
  fetchStagingPage,
  plusOneStaging,
  StagingError,
  submitStaging,
} from "@/lib/staging-client";
import { cn } from "@/lib/utils";
import { VENUE_FUSE_OPTIONS, venueExtendedQuery } from "@/lib/venue-fuse";
import LoadFailure from "@/components/LoadFailure";
import TurnstileWidget from "@/islands/upload/TurnstileWidget";

/** Max venue / staged matches shown per section in the dedup hint (issue #3). */
const MATCH_RESULTS = 3;
/** Min input length before the dedup hint runs (1 char is too noisy). */
const MATCH_MIN_LEN = 2;

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

  // ── +1 (附议) state ─────────────────────────────────────────────────────────
  /** Disable ALL +1 buttons for the session once the 5-venues/day cap is hit. */
  const [plusOneBlocked, setPlusOneBlocked] = useState(false);
  /** One inline +1 message (limit reached / transient failure), null when clear. */
  const [plusOneMsg, setPlusOneMsg] = useState<string | null>(null);

  // ── Dedup match (issue #3) ──────────────────────────────────────────────────
  /** Public match corpus (id+name+voteCount), lazily fetched ONCE when the table
   *  exceeds the SSR batch; stays [] otherwise (the loaded list is then already
   *  the whole table, so no request is made). */
  const [namesCorpus, setNamesCorpus] = useState<StagingNameDto[]>([]);
  const namesFetchedRef = useRef(false);
  /** Optimistic +1 overlay for venues matched in the hint but NOT in the loaded
   *  list, so their button can flip to ✓ without a reload. The resolver below
   *  always prefers the loaded list, so an item in both is never double-counted. */
  const [voteOverlay, setVoteOverlay] = useState<
    Record<string, { votedByMe: boolean; voteCount: number }>
  >({});

  // Collected (real) venues: one Fuse over the bundled set — zero network.
  const venueFuse = useMemo(
    () => new Fuse(collectedVenues, VENUE_FUSE_OPTIONS),
    [],
  );
  // Staged corpus = lazily-fetched names with the loaded list layered on top
  // (the list wins on id collision: freshest optimistic counts + it makes the
  // just-submitted row matchable immediately, no reload).
  const matchCorpus = useMemo<StagingNameDto[]>(() => {
    const byId = new Map<string, StagingNameDto>();
    for (const n of namesCorpus)
      byId.set(n.id, { id: n.id, name: n.name, voteCount: n.voteCount });
    for (const v of venues)
      byId.set(v.id, { id: v.id, name: v.name, voteCount: v.voteCount });
    return [...byId.values()];
  }, [namesCorpus, venues]);
  const stagingFuse = useMemo(
    () =>
      new Fuse(matchCorpus, {
        keys: ["name"],
        ignoreLocation: true,
        threshold: 0.4,
        useExtendedSearch: true,
      }),
    [matchCorpus],
  );

  const matchQuery = name.trim();
  const venueMatches = useMemo<Venue[]>(() => {
    if (matchQuery.length < MATCH_MIN_LEN) return [];
    return venueFuse
      .search(venueExtendedQuery(matchQuery))
      .slice(0, MATCH_RESULTS)
      .map((r) => r.item);
  }, [venueFuse, matchQuery]);
  const stagedMatches = useMemo<StagingNameDto[]>(() => {
    if (matchQuery.length < MATCH_MIN_LEN) return [];
    // Per-token include-match over the single `name` field (mirrors
    // venueExtendedQuery), so multi-keyword input is order-independent.
    const query: Expression = {
      $and: matchQuery.split(/\s+/).map((tok) => ({ name: `'${tok}` })),
    };
    const matched = stagingFuse
      .search(query)
      .slice(0, MATCH_RESULTS)
      .map((r) => r.item);
    // issue #14: a venue that is BOTH collected and still has a staging request
    // must surface ONLY the 已收录 hint, never twice. Drop any staged match whose
    // name resolves (via the shared venueFuse) to a collected venue already shown
    // in venueMatches — there is no id link between the two, so dedup by name.
    if (venueMatches.length === 0) return matched;
    const collectedIds = new Set(venueMatches.map((v) => v.id));
    return matched.filter((m) => {
      const hit = venueFuse.search(venueExtendedQuery(m.name))[0]?.item;
      return !(hit && collectedIds.has(hit.id));
    });
  }, [stagingFuse, matchQuery, venueMatches, venueFuse]);

  // Fetch the match corpus once, lazily, on the FIRST keystroke — and ONLY when
  // the table is bigger than the SSR batch (otherwise the loaded list already is
  // the whole table). Edge-cached + one request/session, never per-keystroke.
  const maybeFetchNames = useCallback(() => {
    if (namesFetchedRef.current || !initialHasMore) return;
    namesFetchedRef.current = true;
    fetchStagingNames().then(setNamesCorpus);
  }, [initialHasMore]);

  /** Resolve a staged match's display state: prefer the loaded list, then the
   *  optimistic +1 overlay, then the corpus baseline (not yet voted). */
  const stagedView = (item: StagingNameDto) => {
    const inList = venues.find((v) => v.id === item.id);
    if (inList)
      return { voteCount: inList.voteCount, votedByMe: inList.votedByMe };
    return (
      voteOverlay[item.id] ?? { voteCount: item.voteCount, votedByMe: false }
    );
  };

  const showMatches =
    hasName && (venueMatches.length > 0 || stagedMatches.length > 0);

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

  // ── +1 ──────────────────────────────────────────────────────────────────────
  // Optimistic: mark voted + bump the count IN PLACE (no live re-sort — re-rank
  // by votes happens on the next load, so rows never jump under the cursor). The
  // optimistic `votedByMe` doubles as the in-flight guard (button disables). On
  // success we reconcile to the server's authoritative count (also covers an
  // idempotent duplicate); on failure we revert, and a 5/day cap also disables
  // every +1 for the session.
  const onPlusOne = useCallback(
    async (venueId: string) => {
      if (plusOneBlocked) return;
      // The target may be a visible list row OR a dedup-hint match not yet in the
      // loaded list — resolve from both. The list, when present, is authoritative.
      const inList = venues.find((v) => v.id === venueId);
      const overlay = voteOverlay[venueId];
      const alreadyVoted = inList
        ? inList.votedByMe
        : (overlay?.votedByMe ?? false);
      if (alreadyVoted) return;
      const baseCount = inList
        ? inList.voteCount
        : (overlay?.voteCount ??
          matchCorpus.find((m) => m.id === venueId)?.voteCount ??
          0);

      setPlusOneMsg(null);
      // Optimistic: bump the visible list (if present) AND the overlay (covers a
      // hint match not in the list). The stagedView resolver prefers the list, so
      // an item in both is never double-counted.
      setVenues((prev) =>
        prev.map((v) =>
          v.id === venueId
            ? { ...v, votedByMe: true, voteCount: v.voteCount + 1 }
            : v,
        ),
      );
      setVoteOverlay((prev) => ({
        ...prev,
        [venueId]: { votedByMe: true, voteCount: baseCount + 1 },
      }));

      try {
        const { voteCount } = await plusOneStaging(venueId);
        setVenues((prev) =>
          prev.map((v) =>
            v.id === venueId ? { ...v, votedByMe: true, voteCount } : v,
          ),
        );
        setVoteOverlay((prev) => ({
          ...prev,
          [venueId]: { votedByMe: true, voteCount },
        }));
      } catch (err) {
        const code = err instanceof StagingError ? err.code : "server_error";
        // Revert the optimistic +1 in both stores.
        setVenues((prev) =>
          prev.map((v) =>
            v.id === venueId
              ? {
                  ...v,
                  votedByMe: false,
                  voteCount: Math.max(0, v.voteCount - 1),
                }
              : v,
          ),
        );
        setVoteOverlay((prev) => {
          const next = { ...prev };
          delete next[venueId];
          return next;
        });
        if (code === "rate_limited_plusone") {
          setPlusOneBlocked(true);
          setPlusOneMsg(t.staging.plusOneLimit);
        } else {
          setPlusOneMsg(t.staging.plusOneError);
        }
      }
    },
    [venues, voteOverlay, matchCorpus, plusOneBlocked, t],
  );

  return (
    <div>
      {/* ── 投稿箱 ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="staging-prompt">
        <h2
          id="staging-prompt"
          className="text-foreground text-2xl font-bold leading-snug"
        >
          {t.staging.promptTitle}
          {t.staging.promptTitleAlt && (
            <>
              <span aria-hidden="true" className="text-muted-foreground mx-2">
                ＼/
              </span>
              <span className="text-muted-foreground">
                {t.staging.promptTitleAlt}
              </span>
            </>
          )}
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
                // First keystroke lazily loads the dedup-match corpus (once).
                maybeFetchNames();
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

        {/* Dedup hint (issue #3): soft, non-blocking. Surfaces venues already in
            the atlas (link out, new tab — don't lose the typed input) and venues
            already requested in the staging list (+1 instead of re-submitting).
            Hidden when there are no matches. */}
        {showMatches && (
          <div
            role="region"
            aria-label={t.staging.matchRegionLabel}
            className="border-border bg-card mt-3 rounded-md border p-3"
          >
            {venueMatches.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  {t.staging.matchCollectedTitle}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {venueMatches.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-foreground truncate text-sm">
                        {venueName(v, locale)}
                      </span>
                      <a
                        href={`/${locale}/v/${v.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded-sm text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {t.staging.matchView} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stagedMatches.length > 0 && (
              <div
                className={
                  venueMatches.length > 0
                    ? "border-border mt-3 border-t pt-3"
                    : ""
                }
              >
                <p className="text-muted-foreground text-xs font-medium">
                  {t.staging.matchStagedTitle}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {stagedMatches.map((m) => {
                    const view = stagedView(m);
                    const votesText = t.staging.votes.replace(
                      "{count}",
                      String(view.voteCount),
                    );
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-foreground truncate text-sm">
                          {m.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-muted-foreground text-xs [font-variant-numeric:tabular-nums]">
                            {votesText}
                          </span>
                          {view.votedByMe ? (
                            <span className="text-foreground inline-flex items-center gap-1 text-xs">
                              <span aria-hidden="true">✓</span>
                              {t.staging.plusOneDone}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onPlusOne(m.id)}
                              disabled={plusOneBlocked}
                              aria-label={t.staging.plusOneLabel.replace(
                                "{name}",
                                m.name,
                              )}
                              className={cn(
                                "border-border text-muted-foreground inline-flex h-7 shrink-0 items-center rounded-md border px-2.5 text-xs font-medium",
                                "transition-colors duration-150 hover:text-foreground hover:border-foreground/40",
                                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                                "disabled:cursor-not-allowed disabled:opacity-50",
                              )}
                            >
                              {t.staging.plusOne}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

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
          {t.staging.listTitleAlt && (
            <>
              <span aria-hidden="true" className="text-muted-foreground mx-2">
                ＼/
              </span>
              <span className="text-muted-foreground">
                {t.staging.listTitleAlt}
              </span>
            </>
          )}
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
                votesLabel={t.staging.votes}
                plusOneLabel={t.staging.plusOne}
                plusOneDoneLabel={t.staging.plusOneDone}
                plusOneAriaLabel={t.staging.plusOneLabel}
                plusOneBlocked={plusOneBlocked}
                onPlusOne={onPlusOne}
                highlight={v.id === highlightId}
              />
            ))}
          </ul>
        )}

        {/* Inline +1 feedback (no toast): the 5/day cap notice or a transient
            failure. Sits just under the list, mirroring the submit feedback. */}
        {plusOneMsg && (
          <p
            className="text-muted-foreground mt-4 text-sm"
            role={plusOneBlocked ? "status" : "alert"}
          >
            {plusOneMsg}
          </p>
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
  /** `{count}` template → "N 人想看" demand tally (need-signal, not a like). */
  votesLabel: string;
  /** "+1" button label. */
  plusOneLabel: string;
  /** Already-seconded (button replaced by a Sumi ✓ marker). */
  plusOneDoneLabel: string;
  /** `{name}` template → button aria-label. */
  plusOneAriaLabel: string;
  /** Session-wide: the 5-venues/day +1 cap was hit → disable the button. */
  plusOneBlocked: boolean;
  onPlusOne: (venueId: string) => void;
  /** Just-submitted row → one-shot Folio Cream highlight that fades out (§7). */
  highlight?: boolean;
}

/**
 * One wishlist entry. Top line: venue name (user verbatim) + relative submit
 * date. Bottom line: the demand tally ("N 人想看" — a need signal for
 * maintainers, deliberately NOT styled as a social like) and a restrained "+1"
 * (附议) button — Sumi/neutral, never the vermilion reserved for the submit/
 * contribution actions. Once seconded the button becomes a Sumi "✓ 已附议"
 * marker (matches the "✓ 已收录" style). A freshly-submitted row briefly lights
 * with Folio Cream then fades (reduced-motion → instant via global CSS).
 */
function StagingRow({
  venue,
  locale,
  processedLabel,
  votesLabel,
  plusOneLabel,
  plusOneDoneLabel,
  plusOneAriaLabel,
  plusOneBlocked,
  onPlusOne,
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
  const votesText = votesLabel.replace("{count}", String(venue.voteCount));

  return (
    <li
      ref={rowRef}
      className="border-border flex flex-col gap-2 border-b py-4 last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-foreground text-sm break-words">
          {venue.name}
        </span>
        <time
          dateTime={new Date(venue.createdAt).toISOString()}
          title={absolute}
          className="text-muted-foreground shrink-0 text-xs [font-variant-numeric:tabular-nums]"
        >
          {relative}
        </time>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Demand tally — quiet, tabular, muted. NOT a vermilion/colored badge. */}
        <span className="text-muted-foreground text-xs [font-variant-numeric:tabular-nums]">
          {votesText}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {venue.processed && (
            // Sumi ink ✓ — never vermilion, never green (decision 2 派生).
            <span className="text-foreground inline-flex items-center gap-1 text-xs">
              <span aria-hidden="true">✓</span>
              {processedLabel}
            </span>
          )}
          {venue.votedByMe ? (
            <span className="text-foreground inline-flex items-center gap-1 text-xs">
              <span aria-hidden="true">✓</span>
              {plusOneDoneLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onPlusOne(venue.id)}
              disabled={plusOneBlocked}
              aria-label={plusOneAriaLabel.replace("{name}", venue.name)}
              className={cn(
                "border-border text-muted-foreground inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-xs font-medium",
                "transition-colors duration-150 hover:text-foreground hover:border-foreground/40",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {plusOneLabel}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

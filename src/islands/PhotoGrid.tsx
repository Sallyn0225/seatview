import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import type { PhotoDto } from "@/lib/photos";
import { imageKeyToUrl } from "@/lib/photos";
import { fetchGridPage } from "@/lib/photos-client";
import { fillTemplate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Photo grid masonry island (R3.9, shape-photo-grid.md).
//
// The "expanded list view" of the seatmap's annotation points: same sub-map
// data, sorted newest-first. Clicking a card opens the Lightbox in SEQUENCE
// mode (left/right paging across this sub-map's photos). The grid never owns
// global selection state — it only:
//   • emits onOpenSequence(photoId, orderedIds, index) on click;
//   • reads `selectedPhotoId` (driven by the Lightbox) to mark the matching
//     card's `selected` visual (brightness -5% + medium caption, NOT shadow —
//     Flat Folio Rule).
//
// Loading strategy (shape §5): first batch is SSR-injected (`initialPhotos`),
// subsequent batches of GRID_BATCH load via an IntersectionObserver sentinel —
// no "load more" button, no spinner. A whole-batch failure retries once after
// RETRY_DELAY_MS, silently (no toast). Single-image failures fall back to a
// Folio Cream block (shape §6 error state). Placeholders are plain Folio Cream
// blocks — no shimmer (SaaS template language, banned).

const GRID_BATCH = 24;
/** Sentinel triggers a fetch this far before the container bottom (shape §11). */
const SENTINEL_ROOT_MARGIN = "600px";
/** Whole-batch fetch failure: retry once after this quiet delay (shape §7). */
const RETRY_DELAY_MS = 60_000;
/** New-card fade-in (shape §6 追加渐入). Instant under reduced-motion via CSS. */
const FADE_MS = 200;

/** PUBLIC_ env var is inlined at build time and safe to read client-side. */
const R2_BASE_URL = import.meta.env.PUBLIC_R2_BASE_URL;

export interface OpenSequencePayload {
  /** The clicked photo id. */
  photoId: string;
  /** All loaded photos of this sub-map in display (time-desc) order, for paging. */
  photos: PhotoDto[];
  /** 0-based index of `photoId` within `photos`. */
  index: number;
}

interface PhotoGridProps {
  locale: Locale;
  venueId: string;
  /** Active sub-map id. Re-mounting/re-loading is keyed on this. */
  subMapId?: string;
  /** SSR-injected first batch for the initial sub-map (request-free paint). */
  initialPhotos: PhotoDto[];
  /** Whether more pages exist beyond the SSR batch (over-fetch probe SSR-side). */
  initialHasMore: boolean;
  /** Cross-island selected photo id (driven by the Lightbox). */
  selectedPhotoId: string | null;
  /** Open the Lightbox in sequence mode at the clicked photo. */
  onOpenSequence: (payload: OpenSequencePayload) => void;
  /** Empty-state CTA: open the upload Sheet (step 6 mount point). */
  onRequestUpload?: () => void;
}

export default function PhotoGrid({
  locale,
  venueId,
  subMapId,
  initialPhotos,
  initialHasMore,
  selectedPhotoId,
  onOpenSequence,
  onRequestUpload,
}: PhotoGridProps) {
  const { t } = useLocale(locale);

  // Photo list + pagination cursor. VenueMain keys this island on the sub-map
  // id, so each instance owns exactly one sub-map's feed (no in-place reset).
  const [photos, setPhotos] = useState<PhotoDto[]>(initialPhotos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef<number>(initialPhotos.length);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Photo ids present before the latest append, so new cards fade in (shape §6).
  const seenIdsRef = useRef<Set<string>>(
    new Set(initialPhotos.map((p) => p.id)),
  );

  // Append the next page for this sub-map. Guards against concurrent runs and
  // appending past the end. On failure, schedules a single silent retry after
  // 60s (shape §7) — no toast, no error UI.
  const loadingRef = useRef(false);
  const loadPage = useCallback(() => {
    if (!subMapId) return;
    if (loadingRef.current) return;
    if (!hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    const offset = offsetRef.current;

    fetchGridPage(venueId, subMapId, offset, GRID_BATCH)
      .then(({ photos: next, hasMore: more }) => {
        offsetRef.current = offset + next.length;
        setHasMore(more);
        setPhotos((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of next) if (!ids.has(p.id)) merged.push(p);
          return merged;
        });
        loadingRef.current = false;
        setLoading(false);
      })
      .catch(() => {
        loadingRef.current = false;
        setLoading(false);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => loadPage(), RETRY_DELAY_MS);
      });
  }, [venueId, subMapId, hasMore]);

  // VenueMain mounts a fresh grid per sub-map (keyed on sub-map id), so each
  // instance starts clean. When the SSR seed is empty (a sub-map other than the
  // one rendered server-side), kick off the first page load on mount instead of
  // waiting for the user to scroll the sentinel into view.
  useEffect(() => {
    if (initialPhotos.length === 0 && hasMore) {
      loadPage();
    }
    // Mount-only: subMapId is fixed for this instance (keyed remount on change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    [],
  );

  // IntersectionObserver sentinel for continuous loading (no button).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadPage();
      },
      { rootMargin: SENTINEL_ROOT_MARGIN },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadPage]);

  // Open the Lightbox in sequence mode with the full loaded set (so it can page
  // left/right) and the clicked photo's index.
  const openAt = useCallback(
    (photoId: string) => {
      const index = photos.findIndex((p) => p.id === photoId);
      onOpenSequence({
        photoId,
        photos,
        index: index < 0 ? 0 : index,
      });
    },
    [photos, onOpenSequence],
  );

  // Card = photo + single seat_label caption, wired as one focusable target
  // (Tab once per card). data-photo-id anchors the card for Lightbox close →
  // scrollIntoView (shape §7). Selected state darkens the photo (-5%) and
  // bolds the caption — color/weight, never box-shadow.
  const renderCard = useCallback(
    (dto: PhotoDto) => {
      const isSelected = dto.id === selectedPhotoId;
      // First time this id is rendered → fade it in once, then mark seen so
      // re-renders (e.g. selection changes) don't re-trigger the fade.
      const isNew = !seenIdsRef.current.has(dto.id);
      if (isNew) seenIdsRef.current.add(dto.id);
      return (
        <PhotoCard
          src={imageKeyToUrl(dto.imageKey, R2_BASE_URL)}
          alt={fillTemplate(t.grid.imageAlt, { label: dto.seatLabel })}
          dto={dto}
          aspect={`${dto.width} / ${dto.height}`}
          selected={isSelected}
          fadeIn={isNew}
          ariaLabel={fillTemplate(t.grid.cardLabel, { label: dto.seatLabel })}
          imageErrorText={t.grid.imageError}
          onActivate={() => openAt(dto.id)}
        />
      );
    },
    [
      selectedPhotoId,
      openAt,
      t.grid.cardLabel,
      t.grid.imageAlt,
      t.grid.imageError,
    ],
  );

  // ── Empty state (gentle 缝隙时刻) ─────────────────────────────────────────
  if (!loading && photos.length === 0) {
    return (
      <div className="px-6 py-12 text-center" data-photo-grid>
        <p className="text-muted-foreground text-sm">{t.grid.emptyBody}</p>
        <button
          type="button"
          onClick={() => onRequestUpload?.()}
          className="text-foreground hover:underline focus-visible:ring-ring mt-1 rounded-sm text-sm underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          {t.grid.emptyCta}
        </button>
      </div>
    );
  }

  return (
    <div data-photo-grid>
      <div className="columns-1 gap-3 md:columns-2 md:gap-4 lg:columns-3 xl:columns-4 xl:gap-5">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="mb-3 break-inside-avoid md:mb-4 xl:mb-5"
          >
            {renderCard(photo)}
          </div>
        ))}
      </div>

      {/* Sentinel + skeleton placeholders while a batch loads (no shimmer). */}
      {hasMore && (
        <div ref={sentinelRef} className="pt-4" aria-hidden={!loading}>
          {loading && (
            <div
              className="flex flex-col items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <span className="sr-only">{t.grid.loading}</span>
              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <SkeletonBlock className="aspect-[3/4]" />
                <SkeletonBlock className="aspect-square" />
                <SkeletonBlock className="aspect-video" />
                <SkeletonBlock className="aspect-[4/5]" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* End-of-feed full stop — no divider, no icon (shape §6 end state). */}
      {!hasMore && photos.length > 0 && (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t.grid.end}
        </p>
      )}
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

interface PhotoCardProps {
  src: string;
  alt: string;
  dto: PhotoDto;
  /** CSS aspect-ratio (`"w / h"`) = the photo's REAL ratio, reserving the box
   *  before the image loads (CLS defense). object-contain then fills it with no
   *  crop (shape-photo-grid.md §10 "照片不裁切"). */
  aspect: string;
  selected: boolean;
  fadeIn: boolean;
  ariaLabel: string;
  imageErrorText: string;
  onActivate: () => void;
}

/**
 * One masonry card: the photo (original ratio, sharp corners, no border/shadow)
 * + a single seat_label caption. Photo + caption are one <button> so keyboard
 * Tab lands once per card (shape §5). States (shape §6):
 *   hover (desktop) → brightness 1.02 (250ms ease-out-quart)
 *   focus           → 2px ink outline, offset 2 (no brightness change)
 *   pressed         → brightness 0.98
 *   selected        → brightness 0.95 + caption medium (color/weight, no shadow)
 *   error           → Folio Cream block + Hairline Ash text, caption still shows
 */
function PhotoCard({
  src,
  alt,
  dto,
  aspect,
  selected,
  fadeIn,
  ariaLabel,
  imageErrorText,
  onActivate,
}: PhotoCardProps) {
  const [errored, setErrored] = useState(false);
  const cardRef = useRef<HTMLButtonElement | null>(null);

  // Fade newly appended cards in once (shape §6 追加渐入); reduced-motion makes
  // the transition instant via the global CSS rule.
  useEffect(() => {
    if (!fadeIn) return;
    const el = cardRef.current;
    if (!el) return;
    el.style.opacity = "0";
    // next frame → transition to 1
    const raf = requestAnimationFrame(() => {
      el.style.transition = `opacity ${FADE_MS}ms ease-out`;
      el.style.opacity = "1";
    });
    return () => cancelAnimationFrame(raf);
  }, [fadeIn]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onActivate}
      aria-label={ariaLabel}
      data-photo-id={dto.id}
      className={cn(
        "group block w-full cursor-pointer text-left",
        "focus-visible:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus:outline-none",
      )}
    >
      {/* Photo box reserves the photo's REAL aspect ratio (CLS defense, Folio
          Cream placeholder, no shimmer) and holds the image at object-contain.
          Because the box ratio == the image ratio (both from the stored
          width/height), contain fills the box edge-to-edge with NO crop and NO
          letterbox gap (shape-photo-grid.md §10 "真实高于齐整, 照片不裁切"). */}
      <span
        className="bg-card block w-full overflow-hidden"
        style={{ aspectRatio: aspect }}
      >
        {errored ? (
          <span className="text-muted-foreground flex size-full items-center justify-center px-2 text-center text-xs">
            {imageErrorText}
          </span>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setErrored(true)}
            className={cn(
              "block size-full select-none object-contain align-top",
              // hover brightness +2% / pressed -2% / selected -5%
              "transition-[filter] duration-[250ms] ease-out",
              selected
                ? "brightness-[0.95]"
                : "group-hover:brightness-[1.02] group-active:brightness-[0.98]",
            )}
          />
        )}
      </span>
      <span
        className={cn(
          "mt-1 block truncate text-[13px] sm:text-[13px]",
          // caption is a footnote: lighter than body, bolder when selected.
          selected ? "text-foreground font-medium" : "text-foreground/75",
        )}
      >
        {dto.seatLabel}
      </span>
    </button>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-card w-full rounded-none", className)}
      aria-hidden="true"
    />
  );
}

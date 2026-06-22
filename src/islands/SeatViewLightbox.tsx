import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Lightbox, {
  type RenderSlideFooterProps,
  type Slide,
} from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LocateFixed,
  Share2,
  X,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import NearbyStrip from "@/islands/lightbox/NearbyStrip";
import TurnstileWidget from "@/islands/upload/TurnstileWidget";
import { clusterPoints, layOutPoints } from "@/lib/cluster";
import { PHOTO_CORRECTION_LABEL_MAX } from "@/lib/photo-corrections";
import {
  PhotoCorrectionError,
  submitPhotoCorrection,
} from "@/lib/photo-corrections-client";
import { setSelectedPhoto } from "@/lib/selected-photo";
import type { PhotoDto } from "@/lib/photos";
import { imageKeyToUrl } from "@/lib/photos";
import {
  absoluteDate,
  fillTemplate,
  performanceDate,
  relativeTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SubMap, Venue } from "@/types";
import { subMapLabel, venueName } from "@/i18n";
import {
  buildShareText,
  buildShareUrl,
  copyToClipboard,
  setPhotoIdInUrl,
} from "@/lib/share";

// Lightbox island (R3.7 + R3.9, shape-lightbox.md).
//
// ONE instance, TWO modes (the "double entry" architecture, shape §7):
//   • single   — opened from a seatmap pin: "look at THIS seat". No left/right
//                paging; close reverse-FLIPs back to the pin; the pin keeps its
//                `selected` highlight ~1.5s after close so the user remembers
//                what they just viewed.
//   • sequence — opened from a grid card: "browse THIS venue's views". Left/
//                right paging across the sub-map's photos, finite (no wrap-
//                around); close returns to the grid and scrolls the current
//                card into view (via the card's data-photo-id anchor).
//
// Cross-island signal (shape §7): on open / page-turn the Lightbox calls
// setSelectedPhoto(id) so the seatmap pin (and grid card) light up; on close it
// calls setSelectedPhoto(null) — after a 1.5s grace in single mode.
//
// Immersive ink overlay (~90% — never #000), photo is the only light source.
// 朱赤 NEVER appears inside the Lightbox (it is "the blank page between folio
// leaves"; vermilion's semantics stay on the seatmap pin + upload button). The
// metadata is a hairline footnote: a bottom strip (seat_label · date) that taps
// open into a ~30% detail sheet (event name + full description + upload time).
// Photo zoom (yarl Zoom plugin) lets users inspect the real view — core value.

export type LightboxMode = "single" | "sequence";

export interface LightboxRequest {
  mode: LightboxMode;
  /** Photos for the lightbox: one entry (single) or the full sub-map (sequence). */
  photos: PhotoDto[];
  /** Start index into `photos`. */
  index: number;
}

interface SeatViewLightboxProps {
  locale: Locale;
  /** Owning venue — used to build share links + the locale-aware share blurb. */
  venue: Venue;
  /** Full point set for the active sub-map, used for same-cluster previews. */
  allPhotos: PhotoDto[];
  /** Active sub-map, providing intrinsic image dimensions for clustering. */
  subMap: SubMap;
  /** Active request (null = closed). VenueMain owns this state. */
  request: LightboxRequest | null;
  /** Called when the user closes the lightbox (Esc / ✕ / backdrop / swipe). */
  onClose: () => void;
  /** Navigate to another photo without closing this lightbox. */
  onNavigate: (photoId: string) => void;
  /** Locate the current photo on the seatmap and close this overlay. */
  onLocate?: (photoId: string) => void;
}

const PUBLIC_R2_BASE_URL = import.meta.env.PUBLIC_R2_BASE_URL;
/** Single-mode pin stays selected this long after close (shape §7 / §10). */
const SELECTED_GRACE_MS = 1500;
/** FLIP / fade timings (shape §11). reduced-motion shortens fade. */
const FADE_MS = 250;
const SWIPE_MS = 150;
const ZOOM_MS = 180;

/** A slide carrying its source DTO so render fns reach the metadata. */
interface SeatSlide extends Slide {
  dto: PhotoDto;
}

function toSlide(dto: PhotoDto, locale: Locale, altTmpl: string): SeatSlide {
  return {
    type: "image",
    // Real intrinsic dimensions from D1 — the lightbox sizes/contains the slide
    // at the photo's true aspect ratio (no derived guess).
    src: imageKeyToUrl(dto.imageKey, PUBLIC_R2_BASE_URL),
    width: dto.width,
    height: dto.height,
    alt: fillTemplate(altTmpl, {
      label: dto.seatLabel,
      date: performanceDate(dto.performanceDate, locale) ?? "",
      event: dto.eventName ?? "",
    }),
    dto,
  };
}

export default function SeatViewLightbox({
  locale,
  venue,
  allPhotos,
  subMap,
  request,
  onClose,
  onNavigate,
  onLocate,
}: SeatViewLightboxProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();

  // Current visible index, tracked from the `view` callback so the cross-island
  // signal + footer metadata follow paging in sequence mode.
  const [currentIndex, setCurrentIndex] = useState(0);
  // Metadata detail sheet open? Esc closes the sheet first (shape §7).
  const [detailOpen, setDetailOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which photo currently shows the "copied" confirmation, + its auto-reset timer.
  const [copiedPhotoId, setCopiedPhotoId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = request !== null;
  const mode = request?.mode ?? "single";
  const photos = request?.photos ?? [];

  const slides = useMemo<SeatSlide[]>(
    () => photos.map((p) => toSlide(p, locale, t.lightbox.imageAlt)),
    [photos, locale, t.lightbox.imageAlt],
  );

  // On open, seed currentIndex + emit the selected signal for the start photo.
  useEffect(() => {
    if (!request) return;
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    setCurrentIndex(request.index);
    setDetailOpen(false);
    setCorrectionOpen(false);
    const startPhoto = request.photos[request.index];
    if (startPhoto) {
      setSelectedPhoto(startPhoto.id);
      setPhotoIdInUrl(startPhoto.id);
    }
  }, [request]);

  useEffect(
    () => () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const currentPhoto = photos[currentIndex];

  const nearbyPhotos = useMemo(() => {
    if (!currentPhoto || currentPhoto.subMapId !== subMap.id) return [];
    const points = layOutPoints(
      allPhotos.filter((photo) => photo.subMapId === currentPhoto.subMapId),
      subMap.width,
      subMap.height,
    );
    const currentCluster = clusterPoints(points, 1).find((cluster) =>
      cluster.members.some((member) => member.photo.id === currentPhoto.id),
    );
    if (!currentCluster || currentCluster.members.length <= 1) return [];
    return currentCluster.members
      .map((member) => member.photo)
      .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  }, [allPhotos, currentPhoto, subMap]);

  // `view` fires on every active-slide change (open + each page turn). Re-emit
  // the selected signal so the seatmap pin tracks the visible photo (shape §7).
  const handleView = useCallback(
    ({ index }: { index: number }) => {
      setCurrentIndex(index);
      setDetailOpen(false);
      setCorrectionOpen(false);
      const photo = photos[index];
      if (photo) {
        setSelectedPhoto(photo.id);
        setPhotoIdInUrl(photo.id);
      }
    },
    [photos],
  );

  // Close: clear the signal. In single mode keep the pin lit for a grace window
  // so the user's spatial memory anchors (shape §7); in sequence mode scroll the
  // current card back into view, then clear immediately.
  const handleClose = useCallback(() => {
    const closingPhoto = photos[currentIndex];
    if (mode === "sequence" && closingPhoto) {
      // Return to the originating grid card (shape §7 scroll-into-view). Scope
      // the lookup to the grid container so we hit the card, not the seatmap
      // pin (both carry the same data-photo-id anchor).
      const card = document.querySelector<HTMLElement>(
        `[data-photo-grid] [data-photo-id="${cssEscape(closingPhoto.id)}"]`,
      );
      card?.scrollIntoView({
        block: "nearest",
        behavior: reducedMotion ? "auto" : "smooth",
      });
      setSelectedPhoto(null);
    } else if (mode === "single" && closingPhoto) {
      // Keep the pin selected 1.5s, then clear.
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      graceTimerRef.current = setTimeout(
        () => setSelectedPhoto(null),
        SELECTED_GRACE_MS,
      );
    } else {
      setSelectedPhoto(null);
    }
    setPhotoIdInUrl(null);
    setDetailOpen(false);
    setCorrectionOpen(false);
    onClose();
  }, [photos, currentIndex, mode, reducedMotion, onClose]);

  // Share the current photo: copy "<blurb> <canonical link>" to the clipboard and
  // flash an in-place "copied" confirmation. The link is photoId-authoritative
  // (`?tab=&photo=`), so it survives a sub-map rename. The region clause appears
  // only when the venue actually has multiple sub-maps (single-map "全场" drops it).
  const handleShare = useCallback(
    async (dto: PhotoDto) => {
      const subMap = venue.subMaps.find((s) => s.id === dto.subMapId);
      const url = buildShareUrl(locale, venue.id, dto.subMapId, dto.id);
      const region =
        venue.subMaps.length > 1 && subMap ? subMapLabel(subMap, locale) : null;
      const text = buildShareText(
        {
          withRegion: t.lightbox.shareTextWithRegion,
          withoutRegion: t.lightbox.shareText,
        },
        { venue: venueName(venue, locale), region, url },
      );
      const ok = await copyToClipboard(text);
      if (!ok) return;
      setCopiedPhotoId(dto.id);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedPhotoId(null), 2000);
    },
    [venue, locale, t.lightbox.shareText, t.lightbox.shareTextWithRegion],
  );

  const handleLocateCurrent = useCallback(() => {
    if (!currentPhoto) return;
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    setPhotoIdInUrl(null);
    setDetailOpen(false);
    setCorrectionOpen(false);
    onLocate?.(currentPhoto.id);
  }, [currentPhoto, onLocate]);

  // Esc priority: when the detail sheet is open, Esc closes the SHEET, not the
  // Lightbox (shape §7). If the correction panel is nested inside it, Esc closes
  // that panel first.
  useEffect(() => {
    if (!open || !detailOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        if (correctionOpen) setCorrectionOpen(false);
        else setDetailOpen(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, detailOpen, correctionOpen]);

  if (!open) return null;

  const isSequence = mode === "sequence";
  const fadeMs = reducedMotion ? Math.min(FADE_MS, 120) : FADE_MS;

  return (
    <Lightbox
      open={open}
      close={handleClose}
      index={currentIndex}
      slides={slides}
      plugins={[Zoom]}
      on={{ view: handleView }}
      // Single mode: hide nav entirely (one slide). Sequence: finite, no wrap.
      carousel={{ finite: true, preload: 1, imageFit: "contain" }}
      controller={{
        closeOnBackdropClick: true,
        closeOnPullDown: true,
        // We own Escape while the sheet is open; yarl handles it otherwise.
        closeOnEscape: !detailOpen,
      }}
      animation={{
        fade: fadeMs,
        swipe: reducedMotion ? 0 : SWIPE_MS,
        navigation: reducedMotion ? 0 : SWIPE_MS,
        zoom: reducedMotion ? 0 : ZOOM_MS,
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        doubleTapDelay: 300,
        scrollToZoom: true,
      }}
      labels={{
        Previous: t.lightbox.prev,
        Next: t.lightbox.next,
        Close: t.lightbox.close,
      }}
      toolbar={{
        buttons: [
          <button
            key="locate"
            type="button"
            className="yarl__button"
            aria-label={t.lightbox.locate}
            title={t.lightbox.locate}
            onClick={handleLocateCurrent}
          >
            <LocateFixed
              className="size-6"
              aria-hidden="true"
              strokeWidth={1.25}
            />
          </button>,
          "close",
        ],
      }}
      // Ink overlay ~90%, no vermilion. Chrome (close / nav) is hairline-ash on
      // ink — quiet, never the SaaS-blue default and never the accent.
      styles={{
        root: {
          // ~90% opacity warm ink (never #000), edge ~10% lets the page bleed
          // through for spatial continuity (shape §5).
          "--yarl__color_backdrop": "oklch(0.13 0.008 75 / 0.9)",
          "--yarl__color_button": "oklch(0.8 0.006 86)",
          "--yarl__color_button_active": "oklch(0.93 0.006 88)",
          "--yarl__color_button_disabled": "oklch(0.5 0.006 86)",
        },
      }}
      render={{
        // Hairline arrows: only in sequence mode; hidden in single mode.
        buttonPrev: isSequence ? undefined : () => null,
        buttonNext: isSequence ? undefined : () => null,
        iconPrev: () => (
          <ChevronLeft
            className="size-7"
            aria-hidden="true"
            strokeWidth={1.25}
          />
        ),
        iconNext: () => (
          <ChevronRight
            className="size-7"
            aria-hidden="true"
            strokeWidth={1.25}
          />
        ),
        iconClose: () => (
          <X className="size-6" aria-hidden="true" strokeWidth={1.25} />
        ),
        // Bottom hairline metadata strip + position indicator (sequence). The
        // position is computed from THIS slide's own index (not the live
        // currentIndex) so a preloaded adjacent footer never shows a stale n/N.
        slideFooter: ({ slide }: RenderSlideFooterProps) => {
          const dto = (slide as SeatSlide).dto;
          if (!dto) return null;
          const slideIndex = slides.findIndex((s) => s.dto.id === dto.id);
          return (
            <FooterStrip
              dto={dto}
              locale={locale}
              isSequence={isSequence}
              position={
                isSequence && slideIndex >= 0
                  ? fillTemplate(t.lightbox.position, {
                      n: String(slideIndex + 1),
                      total: String(slides.length),
                    })
                  : null
              }
              openDetailsLabel={t.lightbox.openDetails}
              onOpenDetails={() => setDetailOpen(true)}
              shareLabel={t.lightbox.share}
              shareCopiedLabel={t.lightbox.shareCopied}
              copied={copiedPhotoId === dto.id}
              onShare={handleShare}
            />
          );
        },
        // Bottom same-cluster previews + the detail sheet overlay.
        controls: () =>
          currentPhoto ? (
            <>
              {nearbyPhotos.length >= 2 && (
                <NearbyStrip
                  items={nearbyPhotos}
                  currentId={currentPhoto.id}
                  onSelect={onNavigate}
                  baseUrl={PUBLIC_R2_BASE_URL}
                  label={t.lightbox.nearbyLabel}
                  thumbLabelTemplate={t.lightbox.nearbyThumbLabel}
                  reducedMotion={reducedMotion}
                />
              )}
              {detailOpen && (
                <DetailSheet
                  dto={currentPhoto}
                  locale={locale}
                  labels={{
                    collapse: t.lightbox.collapse,
                    expand: t.lightbox.expand,
                    uploadedAt: t.lightbox.uploadedAt,
                    correction: t.lightbox.correction,
                  }}
                  correctionOpen={correctionOpen}
                  onCorrectionOpenChange={setCorrectionOpen}
                  onClose={() => setDetailOpen(false)}
                />
              )}
            </>
          ) : null,
      }}
    />
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

/** Minimal CSS.escape fallback (attribute selector safety for ulid ids). */
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\\]]/g, "\\$&");
}

interface FooterStripProps {
  dto: PhotoDto;
  locale: Locale;
  isSequence: boolean;
  position: string | null;
  openDetailsLabel: string;
  onOpenDetails: () => void;
  shareLabel: string;
  shareCopiedLabel: string;
  copied: boolean;
  onShare: (dto: PhotoDto) => void;
}

/**
 * Default-state footnote (shape §5): one hairline line `seat_label · date`,
 * half-transparent over the photo, tap to open the detail sheet. The date row
 * is dropped entirely when empty (no "—" placeholder, shape §6). Position
 * `n / N` sits in a corner in sequence mode, tabular-nums, hairline ash.
 */
function FooterStrip({
  dto,
  locale,
  isSequence,
  position,
  openDetailsLabel,
  onOpenDetails,
  shareLabel,
  shareCopiedLabel,
  copied,
  onShare,
}: FooterStripProps) {
  const date = performanceDate(dto.performanceDate, locale);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={openDetailsLabel}
        className={cn(
          "pointer-events-auto inline-flex min-w-0 max-w-[80%] items-center gap-1.5 rounded-full py-1 pl-2.5 pr-3 text-left",
          "border border-[oklch(0.8_0.006_86_/_0.25)] bg-[oklch(0.13_0.008_75_/_0.6)] text-[oklch(0.93_0.006_88)]",
          "text-sm [font-variant-numeric:tabular-nums] transition-colors",
          "hover:border-[oklch(0.8_0.006_86_/_0.45)] hover:bg-[oklch(0.16_0.008_75_/_0.72)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(0.8_0.006_86)] focus:outline-none",
        )}
      >
        <ChevronUp
          className="size-3.5 shrink-0 opacity-80"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <span className="min-w-0 truncate">
          <span className="font-medium">{dto.seatLabel}</span>
          {date && (
            <span className="opacity-70">
              {" · "}
              {date}
            </span>
          )}
        </span>
      </button>
      <div className="relative flex shrink-0 items-center gap-2">
        {copied && (
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "pointer-events-none absolute bottom-full right-0 mb-2 block max-w-[calc(100vw-2rem)] truncate rounded-full px-2.5 py-1 text-xs",
              "border border-[oklch(0.8_0.006_86_/_0.25)] bg-[oklch(0.13_0.008_75_/_0.82)] text-[oklch(0.93_0.006_88)]",
              "[font-variant-numeric:tabular-nums]",
            )}
          >
            {shareCopiedLabel}
          </span>
        )}
        {isSequence && position && (
          <span
            className="pointer-events-none rounded px-1.5 py-0.5 text-xs text-[oklch(0.8_0.006_86)] [font-variant-numeric:tabular-nums]"
            aria-hidden="true"
          >
            {position}
          </span>
        )}
        <button
          type="button"
          onClick={() => onShare(dto)}
          aria-label={shareLabel}
          title={shareLabel}
          className={cn(
            "pointer-events-auto grid size-11 place-items-center rounded-full",
            "border border-[oklch(0.8_0.006_86_/_0.25)] bg-[oklch(0.13_0.008_75_/_0.6)] text-[oklch(0.93_0.006_88)]",
            "transition-colors hover:border-[oklch(0.8_0.006_86_/_0.45)] hover:bg-[oklch(0.16_0.008_75_/_0.72)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(0.8_0.006_86)] focus:outline-none",
          )}
        >
          <Share2
            className="size-3.5 shrink-0"
            aria-hidden="true"
            strokeWidth={1.5}
          />
        </button>
      </div>
    </div>
  );
}

interface DetailSheetProps {
  dto: PhotoDto;
  locale: Locale;
  labels: {
    collapse: string;
    expand: string;
    uploadedAt: string;
    correction: {
      open: string;
      title: string;
      current: string;
      requested: string;
      placeholder: string;
      turnstileNote: string;
      limitNote: string;
      submit: string;
      submitting: string;
      success: string;
      duplicateSuccess: string;
      missingFields: string;
      photoNotFound: string;
      turnstileError: string;
      limitDaily: string;
      networkError: string;
      serverError: string;
      cancel: string;
    };
  };
  correctionOpen: boolean;
  onCorrectionOpenChange: (open: boolean) => void;
  onClose: () => void;
}

/**
 * Metadata detail sheet (shape §5): slides up ~30% viewport, shows event name +
 * full description + relative upload time. Photo is NOT crushed away (yarl keeps
 * it contain'd; the sheet floats over the bottom). Long descriptions fold to
 * "展开全文 / もっと読む". Esc / re-tap / this close collapses it (not the
 * Lightbox). All text is hairline ash on a deeper ink panel — no vermilion.
 */
function DetailSheet({
  dto,
  locale,
  labels,
  correctionOpen,
  onCorrectionOpenChange,
  onClose,
}: DetailSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [requestedSeatLabel, setRequestedSeatLabel] = useState(dto.seatLabel);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const date = performanceDate(dto.performanceDate, locale);
  const uploaded = relativeTime(dto.createdAt, locale);
  const uploadedTitle = absoluteDate(dto.createdAt, locale);
  const description = dto.description?.trim() || null;
  const isLong = description != null && description.length > 120;
  const requestedTrimmed = requestedSeatLabel.trim();
  const isSameLabel = requestedTrimmed === dto.seatLabel;

  useEffect(() => {
    setRequestedSeatLabel(dto.seatLabel);
    setTurnstileToken(null);
    setSubmitting(false);
    setSubmitState(null);
  }, [dto.id, dto.seatLabel]);

  const correctionErrorMessage = useCallback(
    (err: unknown): string => {
      const code =
        err instanceof PhotoCorrectionError ? err.code : "server_error";
      switch (code) {
        case "missing_fields":
          return labels.correction.missingFields;
        case "photo_not_found":
          return labels.correction.photoNotFound;
        case "turnstile_failed":
          return labels.correction.turnstileError;
        case "rate_limited_daily":
          return labels.correction.limitDaily;
        case "network":
          return labels.correction.networkError;
        case "database_unavailable":
        case "server_misconfigured":
        case "server_error":
        default:
          return labels.correction.serverError;
      }
    },
    [labels.correction],
  );

  const submitCorrection = useCallback(async () => {
    if (!turnstileToken || requestedTrimmed.length === 0) return;
    setSubmitting(true);
    setSubmitState(null);
    try {
      const result = await submitPhotoCorrection(
        dto.id,
        requestedTrimmed.slice(0, PHOTO_CORRECTION_LABEL_MAX),
        turnstileToken,
      );
      setSubmitState({
        kind: "success",
        message: result.duplicate
          ? labels.correction.duplicateSuccess
          : labels.correction.success,
      });
    } catch (err) {
      setSubmitState({ kind: "error", message: correctionErrorMessage(err) });
      setTurnstileToken(null);
    } finally {
      setSubmitting(false);
    }
  }, [
    correctionErrorMessage,
    dto.id,
    labels.correction,
    requestedTrimmed,
    turnstileToken,
  ]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      className={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 z-20 overflow-y-auto",
        correctionOpen ? "max-h-[80vh]" : "max-h-[30vh]",
        "bg-[oklch(0.16_0.008_75_/_0.96)] px-5 py-4 text-[oklch(0.93_0.006_88)]",
      )}
      // Slide-up; reduced-motion handled by global CSS (transition collapses).
      style={{ animation: "yarl-detail-up 200ms ease-out" }}
    >
      <div className="mx-auto max-w-[680px] space-y-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-base font-medium [font-variant-numeric:tabular-nums]">
            {dto.seatLabel}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-2 py-0.5 text-xs text-[oklch(0.8_0.006_86)] hover:text-[oklch(0.93_0.006_88)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(0.8_0.006_86)] focus:outline-none"
          >
            {labels.collapse}
          </button>
        </div>

        {/* Optional fields: render a row only when present (no placeholders). */}
        {date && (
          <p className="text-sm text-[oklch(0.8_0.006_86)] [font-variant-numeric:tabular-nums]">
            {date}
          </p>
        )}
        {dto.eventName && (
          <p className="text-sm text-[oklch(0.86_0.006_88)]">{dto.eventName}</p>
        )}
        {description && (
          <p
            className={cn(
              "text-sm leading-relaxed text-[oklch(0.86_0.006_88)]",
              isLong && !expanded && "line-clamp-3",
            )}
          >
            {description}
          </p>
        )}
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded text-xs text-[oklch(0.8_0.006_86)] underline underline-offset-4 hover:text-[oklch(0.93_0.006_88)] focus-visible:outline focus-visible:outline-2 focus:outline-none"
          >
            {expanded ? labels.collapse : labels.expand}
          </button>
        )}
        <p className="pt-1 text-xs text-[oklch(0.72_0.006_86)] [font-variant-numeric:tabular-nums]">
          {labels.uploadedAt}{" "}
          <time
            dateTime={new Date(dto.createdAt).toISOString()}
            title={uploadedTitle}
          >
            {uploaded}
          </time>
        </p>
        <div className="border-t border-[oklch(0.8_0.006_86_/_0.18)] pt-3">
          {correctionOpen ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[oklch(0.93_0.006_88)]">
                    {labels.correction.title}
                  </p>
                  <p className="mt-1 text-xs text-[oklch(0.72_0.006_86)]">
                    {labels.correction.current}:{" "}
                    <span className="[overflow-wrap:anywhere]">
                      {dto.seatLabel}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onCorrectionOpenChange(false)}
                  className="shrink-0 rounded px-2 py-0.5 text-xs text-[oklch(0.8_0.006_86)] hover:text-[oklch(0.93_0.006_88)] focus-visible:outline focus-visible:outline-2 focus:outline-none"
                >
                  {labels.correction.cancel}
                </button>
              </div>

              <label className="block text-xs text-[oklch(0.8_0.006_86)]">
                {labels.correction.requested}
                <input
                  value={requestedSeatLabel}
                  maxLength={PHOTO_CORRECTION_LABEL_MAX}
                  onChange={(e) => {
                    setRequestedSeatLabel(e.currentTarget.value);
                    setSubmitState(null);
                  }}
                  placeholder={labels.correction.placeholder}
                  className={cn(
                    "mt-1 h-10 w-full rounded-md border px-3 text-sm",
                    "border-[oklch(0.8_0.006_86_/_0.28)] bg-[oklch(0.13_0.008_75_/_0.72)] text-[oklch(0.93_0.006_88)]",
                    "placeholder:text-[oklch(0.72_0.006_86)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(0.8_0.006_86)]",
                  )}
                />
              </label>

              {!submitState || submitState.kind === "error" ? (
                <>
                  <TurnstileWidget onToken={setTurnstileToken} theme="auto" />
                  <p className="text-xs leading-relaxed text-[oklch(0.72_0.006_86)]">
                    {labels.correction.turnstileNote}
                  </p>
                  <p className="text-xs leading-relaxed text-[oklch(0.72_0.006_86)]">
                    {labels.correction.limitNote}
                  </p>
                </>
              ) : null}

              {submitState && (
                <p
                  role="status"
                  className={cn(
                    "text-xs leading-relaxed",
                    submitState.kind === "success"
                      ? "text-[oklch(0.82_0.03_145)]"
                      : "text-[oklch(0.72_0.15_32)]",
                  )}
                >
                  {submitState.message}
                </p>
              )}

              {submitState?.kind !== "success" && (
                <button
                  type="button"
                  onClick={submitCorrection}
                  disabled={
                    submitting ||
                    !turnstileToken ||
                    requestedTrimmed.length === 0 ||
                    isSameLabel
                  }
                  className="inline-flex h-9 items-center rounded-md border border-[oklch(0.8_0.006_86_/_0.35)] px-3 text-xs font-medium text-[oklch(0.93_0.006_88)] transition-colors hover:border-[oklch(0.8_0.006_86_/_0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(0.8_0.006_86)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? labels.correction.submitting
                    : labels.correction.submit}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onCorrectionOpenChange(true)}
              className="rounded text-xs text-[oklch(0.8_0.006_86)] underline underline-offset-4 hover:text-[oklch(0.93_0.006_88)] focus-visible:outline focus-visible:outline-2 focus:outline-none"
            >
              {labels.correction.open}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Fullscreen marking overlay for Upload Step 1. The inline AnnotateSeatmap box
// is too small for precise placement (worst on mobile); the ⤢ button opens this
// near-full-viewport overlay so the seat chart is large and comfortable to mark.
//
// Architecture (PRD): this is presentation-only. It renders the SHARED
// <MarkSurface> off the ONE point the Upload Sheet owns, so placing/dragging
// here updates the exact same point the inline box shows. Undo + Confirm are
// handed in from the Sheet — Confirm reuses the Sheet's confirmPoint(), so it
// closes the overlay AND completes Step 1 (scroll to Step 2) in one tap.
//
// Form follows DESIGN.md "用户主动触发的 overlay": a warm-ink scrim (the "focus
// on this" layer, not a shadow) behind a paper panel. Because the panel is paper
// (bg-background), the chrome reuses the Sheet's own ink/paper button tokens.
// Esc priority mirrors the Lightbox detail sheet: we capture Escape here and the
// Sheet skips its own Esc→close while this is open, so Esc collapses ONLY the
// overlay and never the whole Sheet.

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { SubMap } from "@/types";
import { cn } from "@/lib/utils";
import MarkSurface, { type AnnotationPoint } from "./MarkSurface";

const OVERLAY_ANIM_MS = 250;

interface FullscreenAnnotateProps {
  open: boolean;
  locale: Locale;
  subMap: SubMap;
  /** The single shared point (null = none placed yet). */
  point: AnnotationPoint | null;
  /** Place/drag in the overlay updates the shared point. */
  onChange: (point: AnnotationPoint) => void;
  /** Clear the point ("撤销"). */
  onUndo: () => void;
  /** Confirm = finish Step 1 (the Sheet closes this + advances to Step 2). */
  onConfirm: () => void;
  /** Exit without finishing (✕ / Esc / backdrop). */
  onClose: () => void;
}

export default function FullscreenAnnotate({
  open,
  locale,
  subMap,
  point,
  onChange,
  onUndo,
  onConfirm,
  onClose,
}: FullscreenAnnotateProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();

  // Capture Escape ourselves and swallow it, so the Upload Sheet's own
  // Esc→close handler (which also listens on window, capture) does not also
  // fire. The Sheet additionally skips its handler while we're open; this
  // stopImmediatePropagation is the belt to that suspenders.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={t.uploadSheet.step1.title}
    >
      {/* Warm-ink scrim (a layer of ink, not a shadow). Click the margin to
          exit. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[oklch(0.15_0.008_75_/_0.92)]"
        style={
          reducedMotion
            ? undefined
            : { animation: `seatview-overlay-in ${OVERLAY_ANIM_MS}ms ease-out` }
        }
      />

      {/* Paper panel, near-full-viewport with a thin ink margin. pointer-events
          pass through the margin to the scrim; the panel re-enables them. */}
      <div className="pointer-events-none absolute inset-0 flex p-2 sm:p-3">
        <div className="border-border bg-background pointer-events-auto relative flex flex-1 flex-col overflow-hidden rounded-lg border">
          {/* Header: step title + ✕ */}
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-foreground text-sm font-medium">
              {t.uploadSheet.step1.title}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.uploadSheet.step1.exitFullscreen}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-1 grid size-9 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* Surface: the large shared marking surface on warm paper. The inner
              box MUST keep the SAME 3:2 frame as the inline AnnotateSeatmap box
              and the main Seatmap (SeatmapFrame): x_percent/y_percent are
              normalized within a 3:2 render box, so letting the surface fill a
              non-3:2 flex-1 region skewed MarkSurface.toNormalized — fullscreen
              marks looked right on screen but landed offset on the chart (issue
              #16). We contain a 3:2 box in the available space via container-
              query units: width = min(container width, 1.5×container height), so
              it maxes out without overflowing either axis (warm-paper letterbox
              fills the rest). */}
          <div
            className="bg-card relative flex min-h-0 flex-1 items-center justify-center p-2"
            style={{ containerType: "size" }}
          >
            <div
              className="relative aspect-[3/2]"
              style={{ width: "min(100cqw, 150cqh)" }}
            >
              <MarkSurface
                locale={locale}
                subMap={subMap}
                point={point}
                onChange={onChange}
                large
              />
            </div>
          </div>

          {/* Footer: 撤销 + 确认（确认 = 完成 Step 1）. */}
          <div className="border-border flex items-center gap-4 border-t px-4 py-3">
            <button
              type="button"
              onClick={onUndo}
              disabled={!point}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
            >
              {t.uploadSheet.step1.undo}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!point}
              className={cn(
                "ml-auto inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium",
                "bg-accent/10 text-foreground border-accent/30 border",
                "transition-colors duration-150 hover:bg-accent/15 hover:border-accent/50",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {t.uploadSheet.step1.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

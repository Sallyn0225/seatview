// Embedded annotation seating chart for the upload Sheet, Step 1 (shape §5
// "Sheet 内嵌纯净坐席图").
//
// REUSE WITHOUT INHERITING THE BODY (brief): this shares the *technique* of the
// main Seatmap island — react-zoom-pan-pinch zoom/pan container + the
// xPercent/yPercent ↔ surface-pixel conversion + counter-scaling so the marker
// keeps a constant on-screen size — but it is a SEPARATE, much smaller component
// because its job is the inverse: place exactly ONE adjustable/undoable point on
// a PRISTINE chart (no existing annotations, no clustering, no Lightbox handoff,
// no idle-fading controls). Pulling the main Seatmap in would drag along all the
// cluster/selected/Lightbox wiring it doesn't need and break the "纯净" intent.
//
// Output: a normalized {x,y} in 0..1 (the same space as photos.x_percent /
// y_percent) handed up via onChange. Click/tap to place; drag the dot to adjust;
// the Sheet's "撤销 / 重新标" clears it.

import { useCallback, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { SubMap } from "@/types";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_ANIM_MS = 250;

export interface AnnotationPoint {
  /** Normalized 0..1, matches photos.x_percent. */
  x: number;
  /** Normalized 0..1, matches photos.y_percent. */
  y: number;
}

interface AnnotateSeatmapProps {
  locale: Locale;
  subMap: SubMap;
  /** Current point (null = none placed yet). */
  point: AnnotationPoint | null;
  /** Emitted whenever the point is placed or dragged. */
  onChange: (point: AnnotationPoint) => void;
}

export default function AnnotateSeatmap({
  locale,
  subMap,
  point,
  onChange,
}: AnnotateSeatmapProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();
  const animTime = reducedMotion ? 0 : ZOOM_ANIM_MS;

  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const draggingRef = useRef(false);

  // Convert a client (pointer) position into a normalized 0..1 surface coord,
  // accounting for the current pan/zoom transform of the content box.
  const toNormalized = useCallback(
    (clientX: number, clientY: number): AnnotationPoint | null => {
      const surface = surfaceRef.current;
      if (!surface) return null;
      const rect = surface.getBoundingClientRect();
      // surfaceRef wraps the (already transformed) content, so its rect IS the
      // rendered, scaled+panned image box. Normalize within it.
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { x: clamp01(x), y: clamp01(y) };
    },
    [],
  );

  // Click/tap to place. Skipped while a drag just happened (the drag handler
  // owns that gesture) and ignored if it lands outside the image.
  const handleSurfaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingRef.current) {
        draggingRef.current = false;
        return;
      }
      const next = toNormalized(e.clientX, e.clientY);
      if (next) onChange(next);
    },
    [toNormalized, onChange],
  );

  // Drag the existing dot to adjust. Pointer events on the dot; we stop
  // propagation so the pan gesture / surface click don't also fire.
  const handleDotPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      draggingRef.current = true;

      const move = (ev: PointerEvent) => {
        const next = toNormalized(ev.clientX, ev.clientY);
        if (next) onChange(next);
      };
      const up = (ev: PointerEvent) => {
        target.releasePointerCapture?.(ev.pointerId);
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        // Keep draggingRef true until the click handler clears it (the click
        // fires right after pointerup on the surface).
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
    },
    [toNormalized, onChange],
  );

  return (
    <div className="border-border bg-card relative aspect-[3/2] w-full overflow-hidden rounded-md border">
      <TransformWrapper
        ref={transformRef}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        initialScale={MIN_SCALE}
        centerOnInit
        limitToBounds
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.15 }}
        panning={{ velocityDisabled: reducedMotion }}
        onTransformed={(_ref, state) => setScale(state.scale)}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%", touchAction: "none" }}
          contentStyle={{ width: "100%", height: "100%" }}
        >
          <div
            ref={surfaceRef}
            className="relative size-full"
            onClick={handleSurfaceClick}
          >
            <img
              src={subMap.imageUrl}
              alt=""
              draggable={false}
              className="size-full object-contain select-none"
            />

            {point && (
              <button
                type="button"
                aria-label={t.uploadSheet.step1.markerLabel}
                onPointerDown={handleDotPointerDown}
                className="pointer-events-auto absolute grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full focus-visible:outline-none active:cursor-grabbing"
                style={{
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                  // Counter-scale so the dot stays a constant on-screen size as
                  // the user zooms (same technique as the main seatmap).
                  transform: `translate(-50%, -50%) scale(${1 / scale})`,
                }}
              >
                {/* selected-pin visual: vermilion solid + ink hairline (mirrors
                    the main seatmap's selected pin — the user is placing exactly
                    that pin). 朱赤 is allowed here: it is the annotation point. */}
                <span className="bg-accent border-foreground ring-offset-card group-focus-visible:ring-accent block size-3 scale-110 rounded-full border" />
              </button>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* helper line, top-left */}
      <p className="text-muted-foreground bg-card/80 pointer-events-none absolute left-2 top-2 rounded px-2 py-1 text-xs">
        {t.uploadSheet.step1.helper}
      </p>

      {/* compact ⊕ ⊖ ⟲ controls (36px), bottom-right (shape §5) */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <MiniControl
          label={t.seatmap.zoomIn}
          onClick={() =>
            transformRef.current?.zoomIn(0.4, animTime, "easeOutQuart")
          }
          disabled={scale >= MAX_SCALE - 0.01}
        >
          <Plus className="size-4" aria-hidden="true" />
        </MiniControl>
        <MiniControl
          label={t.seatmap.zoomOut}
          onClick={() =>
            transformRef.current?.zoomOut(0.4, animTime, "easeOutQuart")
          }
          disabled={scale <= MIN_SCALE + 0.01}
        >
          <Minus className="size-4" aria-hidden="true" />
        </MiniControl>
        <MiniControl
          label={t.seatmap.reset}
          onClick={() =>
            transformRef.current?.resetTransform(animTime, "easeOutQuart")
          }
          disabled={scale <= MIN_SCALE + 0.01}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </MiniControl>
      </div>
    </div>
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function MiniControl({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "bg-card text-foreground border-border grid size-9 place-items-center rounded-md border",
        "transition-colors duration-150 hover:bg-secondary",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

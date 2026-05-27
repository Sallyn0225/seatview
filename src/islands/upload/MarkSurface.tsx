// Shared seat-marking surface — the interactive core behind BOTH the inline
// Step-1 box (AnnotateSeatmap) and the fullscreen overlay (FullscreenAnnotate).
//
// It carries ONLY the marking technique: a react-zoom-pan-pinch zoom/pan
// container + the click ↔ normalized {x,y} conversion + counter-scaling so the
// vermilion dot keeps a constant on-screen size as you zoom, plus the ⊕ ⊖ ⟲
// zoom controls and the top-left helper line. It fills its parent (the parent
// owns framing: the inline box's aspect-[3/2]+border, or the overlay's flex-1
// region) and the chart object-contains within it. Coordinates are normalized
// against the chart's REAL content rect (image-rect.ts), not the frame, so the
// surface works in ANY aspect ratio — a tap in the letterbox slack is rejected.
// Place/drag emits {x,y} in 0..1 (photos.x_percent space) via onChange;
// undo/confirm live in the parent so the two surfaces stay in sync off ONE
// shared point.

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
import { useElementSize } from "@/hooks/useElementSize";
import { imageContentRect } from "@/lib/image-rect";
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

interface MarkSurfaceProps {
  locale: Locale;
  subMap: SubMap;
  /** Current point (null = none placed yet). */
  point: AnnotationPoint | null;
  /** Emitted whenever the point is placed or dragged. */
  onChange: (point: AnnotationPoint) => void;
  /** Larger 44px controls for the fullscreen overlay (default: 36px inline). */
  large?: boolean;
}

export default function MarkSurface({
  locale,
  subMap,
  point,
  onChange,
  large = false,
}: MarkSurfaceProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();
  const animTime = reducedMotion ? 0 : ZOOM_ANIM_MS;

  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Unscaled outer box (NOT the transformed content) → the object-contain image
  // content rect for positioning the dot. Re-measured on resize / fullscreen.
  const [outerRef, outerSize] = useElementSize<HTMLDivElement>();
  const [scale, setScale] = useState(MIN_SCALE);
  const draggingRef = useRef(false);

  // The object-contain image rectangle inside the unscaled outer box (the dot
  // anchors to THIS, not the whole frame): x_percent/y_percent are normalized
  // against the image's real content, so the letterbox slack must be excluded.
  const contentRect = imageContentRect(
    outerSize.width,
    outerSize.height,
    subMap.width,
    subMap.height,
  );

  // Convert a client (pointer) position into a normalized 0..1 coord relative to
  // the IMAGE CONTENT rectangle (u,v → a real pixel u·width, v·height on the
  // chart), not the render frame. surfaceRef wraps the already scaled+panned
  // content, so its rect is the rendered image box; object-contain geometry is
  // proportional, so the content rect within that scaled rect is found with the
  // same imageContentRect math. A tap in the letterbox slack (u/v outside 0..1)
  // is rejected.
  const toNormalized = useCallback(
    (clientX: number, clientY: number): AnnotationPoint | null => {
      const surface = surfaceRef.current;
      if (!surface) return null;
      const rect = surface.getBoundingClientRect();
      const cr = imageContentRect(
        rect.width,
        rect.height,
        subMap.width,
        subMap.height,
      );
      if (cr.width <= 0 || cr.height <= 0) return null;
      const u = (clientX - rect.left - cr.offsetX) / cr.width;
      const v = (clientY - rect.top - cr.offsetY) / cr.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      return { x: clamp01(u), y: clamp01(v) };
    },
    [subMap.width, subMap.height],
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

  // Convert the image-relative (u,v) point into a percentage of the UNSCALED
  // content box (= outerSize, the layer the dot lives on inside TransformComponent),
  // folding the letterbox offset back in so the dot lands on the real pixel.
  const dotLeftPct =
    outerSize.width > 0
      ? ((contentRect.offsetX + (point?.x ?? 0) * contentRect.width) /
          outerSize.width) *
        100
      : (point?.x ?? 0) * 100;
  const dotTopPct =
    outerSize.height > 0
      ? ((contentRect.offsetY + (point?.y ?? 0) * contentRect.height) /
          outerSize.height) *
        100
      : (point?.y ?? 0) * 100;

  return (
    <div ref={outerRef} className="relative size-full overflow-hidden">
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
                className="group pointer-events-auto absolute grid size-11 cursor-grab place-items-center rounded-full focus-visible:outline-none active:cursor-grabbing"
                style={{
                  left: `${dotLeftPct}%`,
                  top: `${dotTopPct}%`,
                  // Center on the anchor + counter-scale so the dot stays a
                  // constant on-screen size as the user zooms (same technique as
                  // the main seatmap). Centering MUST live only in this inline
                  // `transform`: Tailwind v4's `-translate-*` utilities emit the
                  // separate CSS `translate` property, which would STACK on top
                  // of this and double the offset (dot lands 50% off the click).
                  transform: `translate(-50%, -50%) scale(${1 / scale})`,
                  transformOrigin: "center",
                }}
              >
                {/* selected-pin visual: vermilion solid + ink hairline (mirrors
                    the main seatmap's selected pin — the user is placing exactly
                    that pin). 朱赤 is allowed here: it is the annotation point. */}
                <span className="bg-accent border-foreground ring-offset-card group-focus-visible:ring-accent group-focus-visible:ring-2 group-focus-visible:ring-offset-2 block size-3 scale-110 rounded-full border" />
              </button>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* helper line, top-left */}
      <p className="text-muted-foreground bg-card/80 pointer-events-none absolute left-2 top-2 rounded px-2 py-1 text-xs">
        {t.uploadSheet.step1.helper}
      </p>

      {/* compact ⊕ ⊖ ⟲ controls, bottom-right (shape §5) */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <MiniControl
          label={t.seatmap.zoomIn}
          large={large}
          onClick={() =>
            transformRef.current?.zoomIn(0.4, animTime, "easeOutQuart")
          }
          disabled={scale >= MAX_SCALE - 0.01}
        >
          <Plus className={large ? "size-5" : "size-4"} aria-hidden="true" />
        </MiniControl>
        <MiniControl
          label={t.seatmap.zoomOut}
          large={large}
          onClick={() =>
            transformRef.current?.zoomOut(0.4, animTime, "easeOutQuart")
          }
          disabled={scale <= MIN_SCALE + 0.01}
        >
          <Minus className={large ? "size-5" : "size-4"} aria-hidden="true" />
        </MiniControl>
        <MiniControl
          label={t.seatmap.reset}
          large={large}
          onClick={() =>
            transformRef.current?.resetTransform(animTime, "easeOutQuart")
          }
          disabled={scale <= MIN_SCALE + 0.01}
        >
          <RotateCcw
            className={large ? "size-4" : "size-3.5"}
            aria-hidden="true"
          />
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
  large,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  large: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "bg-card text-foreground border-border grid place-items-center rounded-md border",
        large ? "size-11" : "size-9",
        "transition-colors duration-150 hover:bg-secondary",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

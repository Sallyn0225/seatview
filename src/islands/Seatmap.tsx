import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getMessages, subMapLabel } from "@/i18n";
import { fillTemplate } from "@/lib/format";
import { useLocale } from "@/hooks/useLocale";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useElementSize } from "@/hooks/useElementSize";
import { setSelectedPhoto } from "@/lib/selected-photo";
import { clusterPoints, layOutPoints, type Cluster } from "@/lib/cluster";
import { imageContentRect } from "@/lib/image-rect";
import type { PhotoDto } from "@/lib/photos";
import type { SubMap } from "@/types";
import { cn } from "@/lib/utils";
import LoadFailure from "@/components/LoadFailure";

// Seating chart island (R3.4-R3.8, shape-seatmap-component.md).
//
// react-zoom-pan-pinch wraps the chart image; annotation points overlay it via
// xPercent/yPercent and counter-scale so they stay a constant on-screen size as
// you zoom. Adjacent points cluster (screen-pixel threshold, inverse to zoom);
// clicking a cluster zooms in so it "explodes" into individual pins (ADR-4);
// clicking a single pin emits the cross-island selected-photo signal and the
// onOpenLightbox mount-point for step 5.
//
// react-zoom-pan-pinch v4 exposes `setTransform` / `resetTransform` for
// programmatic cluster zoom and reset. We compute the target position manually
// so the cluster centroid lands at the viewport center.

const MIN_SCALE = 1;
const MAX_SCALE = 6;
// react-zoom-pan-pinch v4 removed v3's separate wheel.smoothStep; 0.001 keeps
// one mouse-wheel notch near the old gradual zoom while leaving buttons intact.
const WHEEL_ZOOM_STEP = 0.001;
const FRAME_FALLBACK_WIDTH = 1.5;
const FRAME_FALLBACK_HEIGHT = 1;
/** Zoom multiplier applied when a cluster is clicked (shape §7: ×2). */
const CLUSTER_ZOOM_FACTOR = 2;
/** Programmatic-zoom animation duration (ms). 0 when reduced-motion. */
const ZOOM_ANIM_MS = 400;
/** Controls fade to 50% opacity after this idle window (shape §5). */
const CONTROLS_IDLE_MS = 5000;

interface SeatmapProps {
  locale: Locale;
  subMap: SubMap;
  /** Annotation points for this sub-map (SSR-injected or re-fetched). */
  photos: PhotoDto[];
  /** Loading the points (sub-map switch in flight). */
  loading?: boolean;
  /** Point load failed (R3 error Key State). */
  error?: boolean;
  /** Currently selected photo id from the cross-island signal. */
  selectedPhotoId: string | null;
  /**
   * Mount point for step 5: clicking a single pin opens the Lightbox here.
   * Optional so the seatmap works standalone before the Lightbox lands.
   */
  onOpenLightbox?: (photoId: string) => void;
  /** Retry the point fetch (wired to the shared <LoadFailure> on error). */
  onRetry?: () => void;
}

export default function Seatmap({
  locale,
  subMap,
  photos,
  loading = false,
  error = false,
  selectedPhotoId,
  onOpenLightbox,
  onRetry,
}: SeatmapProps) {
  const { t } = useLocale(locale);
  const reducedMotion = usePrefersReducedMotion();

  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const wrapperNodeRef = useRef<HTMLDivElement | null>(null);
  // Unscaled frame box (NOT the zoom/pan-transformed layer) → the object-contain
  // chart-image content rect that pins anchor to. Re-measured on resize.
  const [observeWrapper, wrapperSize] = useElementSize<HTMLDivElement>();
  const setWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperNodeRef.current = node;
      observeWrapper(node);
    },
    [observeWrapper],
  );

  // Live transform state, driven by onTransform. Drives clustering threshold,
  // counter-scaling, and the scale indicator.
  const [scale, setScale] = useState(MIN_SCALE);
  const [isTransforming, setIsTransforming] = useState(false);

  // Controls idle fade.
  const [controlsIdle, setControlsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wakeControls = useCallback(() => {
    setControlsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(
      () => setControlsIdle(true),
      CONTROLS_IDLE_MS,
    );
  }, []);

  useEffect(() => {
    wakeControls();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [wakeControls]);

  // Lay points onto the image surface once per photo set / sub-map size.
  const laidOut = useMemo(
    () => layOutPoints(photos, subMap.width, subMap.height),
    [photos, subMap.width, subMap.height],
  );

  // Re-cluster whenever the zoom scale changes (threshold is inverse to scale).
  // Sort render order top→bottom, left→right so DOM order (and thus keyboard
  // Tab order) follows reading order (shape §6). Banded by ~5% rows so a small
  // vertical jitter doesn't scramble an otherwise-horizontal row.
  const clusters = useMemo(() => {
    const rowBand = subMap.height * 0.05;
    return clusterPoints(laidOut, scale).sort((a, b) => {
      const rowA = Math.round(a.y / rowBand);
      const rowB = Math.round(b.y / rowBand);
      return rowA !== rowB ? rowA - rowB : a.x - b.x;
    });
  }, [laidOut, scale, subMap.height]);

  const animTime = reducedMotion ? 0 : ZOOM_ANIM_MS;

  // Center the viewport on a cluster centroid and zoom in so its members spread
  // apart (ADR-4). setTransform takes the content TOP-LEFT position, so we solve
  // for the position that puts the centroid at the wrapper center at the target
  // scale: pos = center - centroidSurface * targetScale.
  const focusCluster = useCallback(
    (cluster: Cluster) => {
      const api = transformRef.current;
      const wrapper = wrapperNodeRef.current;
      if (!api || !wrapper) return;

      const targetScale = Math.min(scale * CLUSTER_ZOOM_FACTOR, MAX_SCALE);
      const rect = wrapper.getBoundingClientRect();
      // The chart is object-contain inside the wrapper, so clusters (in image
      // pixels) map to the IMAGE CONTENT rect, not the whole wrapper — the
      // letterbox offset must be added or the centroid lands in the slack.
      const cr = imageContentRect(
        rect.width,
        rect.height,
        subMap.width,
        subMap.height,
      );
      const surfaceX = cr.offsetX + (cluster.x / subMap.width) * cr.width;
      const surfaceY = cr.offsetY + (cluster.y / subMap.height) * cr.height;
      const positionX = rect.width / 2 - surfaceX * targetScale;
      const positionY = rect.height / 2 - surfaceY * targetScale;

      api.setTransform(
        positionX,
        positionY,
        targetScale,
        animTime,
        "easeOutQuart",
      );
      wakeControls();
    },
    [scale, subMap.width, subMap.height, animTime, wakeControls],
  );

  const handlePinClick = useCallback(
    (photoId: string) => {
      // Emit the cross-island signal so the matching pin (and step-5 grid card)
      // light up in their selected state, then hand off to the Lightbox.
      setSelectedPhoto(photoId);
      onOpenLightbox?.(photoId);
    },
    [onOpenLightbox],
  );

  // ── Key States ──────────────────────────────────────────────────────────
  // Point-set load failure → the shared inline <LoadFailure> (error-pages §4:
  // all load-failure states unify here; its copy wins over the old per-component
  // errorBody). It fills the fixed-ratio seatmap frame; retry re-runs the fetch.
  if (error) {
    return (
      <SeatmapFrame subMapId={subMap.id}>
        <LoadFailure locale={locale} onRetry={() => onRetry?.()} fill />
      </SeatmapFrame>
    );
  }

  if (!loading && photos.length === 0) {
    return (
      <SeatmapFrame subMapId={subMap.id}>
        <ChartImage subMap={subMap} locale={locale} dimmed />
        <div className="bg-background/55 absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
          <p className="text-foreground text-sm">{t.seatmap.emptyBody}</p>
          <p className="text-muted-foreground text-sm">{t.seatmap.emptyCta}</p>
        </div>
      </SeatmapFrame>
    );
  }

  return (
    <SeatmapFrame subMapId={subMap.id}>
      <div ref={setWrapperRef} className="absolute inset-0">
        <TransformWrapper
          ref={transformRef}
          minScale={MIN_SCALE}
          maxScale={MAX_SCALE}
          initialScale={MIN_SCALE}
          centerOnInit
          limitToBounds
          doubleClick={{ disabled: true }}
          wheel={{ step: WHEEL_ZOOM_STEP }}
          panning={{ velocityDisabled: reducedMotion }}
          onTransform={(_ref, state) => setScale(state.scale)}
          onPanningStart={() => {
            setIsTransforming(true);
            wakeControls();
          }}
          onPanningStop={() => setIsTransforming(false)}
          onZoomStart={() => {
            setIsTransforming(true);
            wakeControls();
          }}
          onZoomStop={() => setIsTransforming(false)}
        >
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              height: "100%",
              // Library takes over gestures; block native pinch-zoom.
              touchAction: "none",
            }}
            contentStyle={{ width: "100%", height: "100%" }}
          >
            <div className="relative size-full" onPointerDown={wakeControls}>
              <ChartImage subMap={subMap} locale={locale} />

              {/* Annotation overlay: pins + cluster bubbles. Positioned against
                  the object-contain image content rect (image-relative coords),
                  not the raw frame, so pins land on real chart pixels on any
                  aspect ratio. */}
              {clusters.map((cluster) => {
                const leftPct = clusterPctX(cluster, subMap, wrapperSize);
                const topPct = clusterPctY(cluster, subMap, wrapperSize);
                const isCluster = cluster.members.length > 1;
                return (
                  <div
                    key={cluster.id}
                    className="pointer-events-none absolute"
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      // Counter-scale so markers keep a constant on-screen size
                      // (frontend-libraries.md overlay pattern).
                      transform: `translate(-50%, -50%) scale(${1 / scale})`,
                      transformOrigin: "center",
                    }}
                  >
                    {isCluster ? (
                      <ClusterBubble
                        count={cluster.members.length}
                        label={t.seatmap.clusterLabel.replace(
                          "{count}",
                          String(cluster.members.length),
                        )}
                        onActivate={() => focusCluster(cluster)}
                      />
                    ) : (
                      <Pin
                        photo={cluster.members[0]!.photo}
                        label={t.seatmap.pinLabel.replace(
                          "{label}",
                          cluster.members[0]!.photo.seatLabel,
                        )}
                        selected={
                          cluster.members[0]!.photo.id === selectedPhotoId
                        }
                        onActivate={() =>
                          handlePinClick(cluster.members[0]!.photo.id)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Loading veil over the chart while points re-fetch (sub-map switch). */}
      {loading && (
        <div
          className="bg-background/40 absolute inset-0 flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">{t.seatmap.loading}</span>
          <span
            aria-hidden="true"
            className="border-accent/30 border-t-accent size-6 animate-spin rounded-full border-2"
          />
        </div>
      )}

      <ZoomControls
        idle={controlsIdle}
        scale={scale}
        labels={{
          zoomIn: t.seatmap.zoomIn,
          zoomOut: t.seatmap.zoomOut,
          reset: t.seatmap.reset,
        }}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        showIndicator={isTransforming}
        onZoomIn={() => {
          transformRef.current?.zoomIn(0.4, animTime, "easeOutQuart");
          wakeControls();
        }}
        onZoomOut={() => {
          transformRef.current?.zoomOut(0.4, animTime, "easeOutQuart");
          wakeControls();
        }}
        onReset={() => {
          transformRef.current?.resetTransform(animTime, "easeOutQuart");
          wakeControls();
        }}
      />
    </SeatmapFrame>
  );
}

/* ── Overlay positioning helpers ───────────────────────────────────────────
 * A cluster lives at image pixel (cluster.x, cluster.y). The overlay layer fills
 * the UNSCALED frame (wrapperSize), but the chart is object-contain within it, so
 * a pin's percent position is (contentOffset + imageFraction·contentSize) over
 * the frame extent. Before the frame is measured, use SeatmapFrame's known 3:2
 * ratio so SSR and first client paint use the same coordinate contract. */
function clusterPctX(
  cluster: Cluster,
  subMap: SubMap,
  frame: { width: number; height: number },
): number {
  if (frame.width <= 0 || frame.height <= 0) {
    return fallbackFramePct(cluster.x / subMap.width, "x", subMap);
  }
  const cr = imageContentRect(
    frame.width,
    frame.height,
    subMap.width,
    subMap.height,
  );
  return (
    ((cr.offsetX + (cluster.x / subMap.width) * cr.width) / frame.width) * 100
  );
}

function clusterPctY(
  cluster: Cluster,
  subMap: SubMap,
  frame: { width: number; height: number },
): number {
  if (frame.width <= 0 || frame.height <= 0) {
    return fallbackFramePct(cluster.y / subMap.height, "y", subMap);
  }
  const cr = imageContentRect(
    frame.width,
    frame.height,
    subMap.width,
    subMap.height,
  );
  return (
    ((cr.offsetY + (cluster.y / subMap.height) * cr.height) / frame.height) *
    100
  );
}

function fallbackFramePct(
  fraction: number,
  axis: "x" | "y",
  subMap: SubMap,
): number {
  const cr = imageContentRect(
    FRAME_FALLBACK_WIDTH,
    FRAME_FALLBACK_HEIGHT,
    subMap.width,
    subMap.height,
  );
  if (axis === "x") {
    return ((cr.offsetX + fraction * cr.width) / FRAME_FALLBACK_WIDTH) * 100;
  }
  return ((cr.offsetY + fraction * cr.height) / FRAME_FALLBACK_HEIGHT) * 100;
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

interface SeatmapFrameProps {
  subMapId: string;
  children: React.ReactNode;
}

/** Outer surface: fixed 3:2 viewport, clipped, hairline border, no shadow. */
function SeatmapFrame({ subMapId, children }: SeatmapFrameProps) {
  return (
    <div
      className="border-border bg-card relative aspect-[3/2] w-full overflow-hidden rounded-md border"
      data-seatmap
      data-sub-map-id={subMapId}
    >
      {children}
    </div>
  );
}

function ChartImage({
  subMap,
  locale,
  dimmed = false,
}: {
  subMap: SubMap;
  locale: Locale;
  dimmed?: boolean;
}) {
  const alt = fillTemplate(getMessages(locale).seatmap.chartAlt, {
    label: subMapLabel(subMap, locale),
  });
  return (
    <img
      src={subMap.imageUrl}
      alt={alt}
      draggable={false}
      className={cn(
        "size-full object-contain select-none",
        dimmed && "opacity-40",
      )}
    />
  );
}

interface PinProps {
  photo: PhotoDto;
  label: string;
  selected: boolean;
  onActivate: () => void;
}

/**
 * Single annotation pin. Vermilion is the marker identity (issue #7): the quiet
 * "sunk into paper" default vanished on the colored venue maps, so every pin now
 * carries a solid 朱赤 core + a paper halo ring (border, not shadow) that keeps
 * it legible over any map color (blue seats / white aisles / ink frame).
 *   default  → vermilion core + paper ring, ~14px
 *   hover    → ~1.2x + faint vermilion halo (ring, not shadow)
 *   focus    → 2px vermilion focus ring (≥3:1)
 *   selected → larger + ink ring + faint vermilion micro-halo (only while
 *              Lightbox open)
 * Color is not the only channel: selected pins also grow + swap the paper ring
 * for an ink one, so the state reads without relying on hue (DESIGN.md
 * non-color-only rule).
 */
function Pin({ photo, label, selected, onActivate }: PinProps) {
  return (
    <button
      type="button"
      // 44x44 touch target (transparent), centered on the visible ~14px marker.
      className={cn(
        "group pointer-events-auto grid size-11 place-items-center rounded-full",
        "focus-visible:outline-none",
      )}
      aria-label={label}
      aria-pressed={selected}
      data-photo-id={photo.id}
      onClick={onActivate}
    >
      <span
        className={cn(
          "block rounded-full transition-[transform,background-color,border-color] duration-150",
          // Vermilion core for every pin; the ring (border) provides the halo.
          "bg-accent",
          selected
            ? // selected: larger + ink ring + tight vermilion micro-halo.
              "border-foreground size-4 scale-105 border-2 ring-2 ring-accent/45"
            : // default: paper halo ring keeps the core legible on any map color.
              "border-background size-3.5 border-2",
          // hover (desktop): 1.2x + faint vermilion halo ring (not a shadow).
          "group-hover:ring-accent/25 group-hover:scale-[1.2] group-hover:ring-4",
          // focus (keyboard): 2px vermilion ring (≥3:1), offset on paper.
          "ring-offset-card group-focus-visible:ring-accent group-focus-visible:ring-2 group-focus-visible:ring-offset-2",
        )}
      />
    </button>
  );
}

interface ClusterBubbleProps {
  count: number;
  label: string;
  onActivate: () => void;
}

/**
 * Aggregate count bubble (shape §5.3): warm-white fill + ink tabular-nums text.
 * Stays neutral (no vermilion) so the hierarchy reads — vermilion = a single
 * annotation point, neutral = an aggregate count. The ink-toned contrast ring
 * (border, not shadow) keeps it legible on any map color (issue #7). No
 * gradient, no display font, no shadow.
 */
function ClusterBubble({ count, label, onActivate }: ClusterBubbleProps) {
  return (
    <button
      type="button"
      className={cn(
        "group pointer-events-auto grid size-11 place-items-center rounded-full",
        "focus-visible:outline-none",
      )}
      aria-label={label}
      onClick={onActivate}
    >
      <span
        className={cn(
          "bg-card text-foreground grid size-8 place-items-center rounded-full",
          // Ink-toned contrast ring so the bubble reads on any map color.
          "border-[1.5px] border-foreground/40",
          "text-xs font-bold [font-variant-numeric:tabular-nums]",
          "transition-[transform] duration-150 group-hover:scale-110",
          "ring-offset-card group-focus-visible:ring-accent group-focus-visible:ring-2 group-focus-visible:ring-offset-2",
        )}
      >
        {count}
      </span>
    </button>
  );
}

interface ZoomControlsProps {
  idle: boolean;
  scale: number;
  minScale: number;
  maxScale: number;
  showIndicator: boolean;
  labels: { zoomIn: string; zoomOut: string; reset: string };
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/** Bottom-right ＋/−/⟲ controls + bottom-left scale indicator (shape §5.4-5.5). */
function ZoomControls({
  idle,
  scale,
  minScale,
  maxScale,
  showIndicator,
  labels,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlsProps) {
  const atMax = scale >= maxScale - 0.01;
  const atMin = scale <= minScale + 0.01;
  return (
    <>
      {showIndicator && (
        <div
          className="text-muted-foreground bg-card/80 pointer-events-none absolute bottom-3 left-3 rounded px-2 py-1 font-mono text-xs [font-variant-numeric:tabular-nums]"
          aria-hidden="true"
        >
          {scale.toFixed(1)}x
        </div>
      )}
      <div
        className={cn(
          "absolute right-3 bottom-3 flex flex-col gap-1.5 transition-opacity duration-300",
          idle ? "opacity-50" : "opacity-100",
        )}
      >
        <ControlButton
          label={labels.zoomIn}
          onClick={onZoomIn}
          disabled={atMax}
        >
          <Plus className="size-5" aria-hidden="true" />
        </ControlButton>
        <ControlButton
          label={labels.zoomOut}
          onClick={onZoomOut}
          disabled={atMin}
        >
          <Minus className="size-5" aria-hidden="true" />
        </ControlButton>
        <ControlButton label={labels.reset} onClick={onReset} disabled={atMin}>
          <RotateCcw className="size-4" aria-hidden="true" />
        </ControlButton>
      </div>
    </>
  );
}

function ControlButton({
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
      aria-disabled={disabled}
      className={cn(
        "bg-card text-foreground border-border grid size-11 place-items-center rounded-md border",
        "transition-colors duration-150",
        "hover:bg-secondary focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

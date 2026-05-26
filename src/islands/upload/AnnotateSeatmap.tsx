// Inline annotation seat chart for the upload Sheet, Step 1 (shape §5 "Sheet
// 内嵌纯净坐席图"). It is the SMALL, framed entry point: a fixed aspect-[3/2]
// box wrapping the shared <MarkSurface> (the actual zoom/pan + place/drag
// technique) plus a ⤢ button that hands off to the fullscreen overlay when the
// little box feels too cramped for precise marking.
//
// The marking surface itself (and the normalized {x,y} 0..1 output handed up via
// onChange) lives in MarkSurface, shared verbatim with FullscreenAnnotate so the
// two never diverge — both render off the ONE point owned by the Sheet.

import { Maximize2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import type { SubMap } from "@/types";
import MarkSurface, { type AnnotationPoint } from "./MarkSurface";

export type { AnnotationPoint };

interface AnnotateSeatmapProps {
  locale: Locale;
  subMap: SubMap;
  /** Current point (null = none placed yet). */
  point: AnnotationPoint | null;
  /** Emitted whenever the point is placed or dragged. */
  onChange: (point: AnnotationPoint) => void;
  /** Open the fullscreen marking overlay (⤢ button). */
  onRequestFullscreen: () => void;
}

export default function AnnotateSeatmap({
  locale,
  subMap,
  point,
  onChange,
  onRequestFullscreen,
}: AnnotateSeatmapProps) {
  const { t } = useLocale(locale);

  return (
    <div className="border-border bg-card relative aspect-[3/2] w-full overflow-hidden rounded-md border">
      <MarkSurface
        locale={locale}
        subMap={subMap}
        point={point}
        onChange={onChange}
      />

      {/* ⤢ fullscreen toggle, top-right (clear of the bottom-right zoom stack
          and the top-left helper line). */}
      <button
        type="button"
        onClick={onRequestFullscreen}
        aria-label={t.uploadSheet.step1.fullscreen}
        title={t.uploadSheet.step1.fullscreen}
        className="bg-card text-foreground border-border hover:bg-secondary focus-visible:ring-ring absolute right-2 top-2 grid size-9 place-items-center rounded-md border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
      >
        <Maximize2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

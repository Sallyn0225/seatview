import { useEffect, useState, type RefObject } from "react";

// Track an element's rendered (CSS) size as a React value, kept fresh by a
// ResizeObserver. Used by the seatmap + the upload mark surface to know the
// UNSCALED container box so they can compute the object-contain content rect
// (src/lib/image-rect.ts) — the annotation coordinate base. The observed box is
// the static frame (NOT the zoom/pan-transformed layer), so the size only
// changes on layout/resize (viewport, fullscreen open), not on every zoom tick.

export interface ElementSize {
  width: number;
  height: number;
}

const ZERO: ElementSize = { width: 0, height: 0 };

/**
 * Observe `ref`'s border-box size. Returns `{0,0}` until the element mounts and
 * the first observation fires (callers fall back to the full container, so a
 * single pre-measure frame renders harmlessly).
 */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): ElementSize {
  const [size, setSize] = useState<ElementSize>(ZERO);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    // Seed synchronously so the first paint has real dimensions where possible.
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefCallback,
} from "react";

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
 * Observe the current node's content-box size. A callback ref is intentional:
 * seatmap branches can replace the measured DOM node (for example empty state
 * -> loaded state), and a stable RefObject would keep observing the old node.
 */
export function useElementSize<T extends HTMLElement = HTMLElement>(): [
  RefCallback<T>,
  ElementSize,
] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>(ZERO);
  const ref = useCallback<RefCallback<T>>((node) => {
    setElement(node);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      setSize(ZERO);
      return;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    // Seed before paint on the client so coordinate overlays do not spend a
    // visible frame in the unmeasured fallback.
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return [ref, size];
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

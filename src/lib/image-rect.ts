// object-contain geometry — the shared math behind the new annotation-coordinate
// semantics (task 05-27-image-relative-coords).
//
// `photos.x_percent` / `y_percent` are normalized 0..1 against the image's REAL
// content rectangle (u·subMap.width, v·subMap.height = a true pixel on the chart),
// NOT against the render frame. So every read/write path needs to know where the
// object-contain image actually sits inside its container (the letterbox offset
// + the rendered content size). This is pure geometry — no DOM, no
// `img.naturalWidth` — driven entirely by the container size and the sub-map's
// stored intrinsic pixels, so it works identically on the server and the client.

/** The real on-screen rectangle an object-contain image occupies in a container. */
export interface ContentRect {
  /** Letterbox offset from the container's left edge, px (0 on the tight axis). */
  offsetX: number;
  /** Letterbox offset from the container's top edge, px. */
  offsetY: number;
  /** Rendered width of the image content, px (<= containerW). */
  width: number;
  /** Rendered height of the image content, px (<= containerH). */
  height: number;
}

/**
 * Given a container size and the image's natural (intrinsic) size, compute the
 * rectangle the image occupies when rendered with `object-contain` (scaled to
 * fit, centered, letterboxed on the slack axis).
 *
 * Pure function: `containerW/H` may come from `getBoundingClientRect()` or from a
 * fixed layout ratio. Degenerate inputs (<= 0) fall back to the full container so
 * callers never divide by zero.
 */
export function imageContentRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
): ContentRect {
  if (naturalW <= 0 || naturalH <= 0 || containerW <= 0 || containerH <= 0) {
    return { offsetX: 0, offsetY: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    offsetX: (containerW - width) / 2,
    offsetY: (containerH - height) / 2,
    width,
    height,
  };
}

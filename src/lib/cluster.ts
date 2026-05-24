// Annotation-point clustering for the seatmap (R3.5 / R3.6 / Open Question Q6).
//
// Points are clustered by SCREEN-pixel proximity, and the threshold shrinks as
// the user zooms in (inverse to scale): two pins that overlap at scale 1 pull
// apart and become individually clickable as you zoom. This is what makes the
// "click cluster → zoom in → it explodes into single pins" flow work (ADR-4).
//
// Algorithm: greedy single-pass grid-free agglomeration. O(n²) worst case, but
// n is a single sub-map's point count (tens, not thousands) so this is fine for
// the MVP. If a sub-map ever holds 100s of points we'd swap in a spatial grid
// (noted in frontend-libraries.md performance checkpoints).
//
// All magic numbers live in CLUSTER_TUNING so Q6 ("initial 36px/scale, tune
// after seeing it") is a one-line change.

import type { PhotoDto } from "@/lib/photos";

export const CLUSTER_TUNING = {
  /**
   * Base merge distance in SCREEN pixels at scale 1. Two points whose
   * on-screen centers are closer than `BASE_THRESHOLD_PX / scale` merge into a
   * cluster. 36px ≈ comfortably larger than a 8-10px pin so visually touching
   * pins group up (Q6 initial value).
   */
  BASE_THRESHOLD_PX: 36,
  /** Below this scale, never cluster (points are spread enough). Keeps fully
   *  zoomed-in views showing every individual pin even if data is dense. */
  MIN_THRESHOLD_PX: 2,
} as const;

/** A point laid out on the (unscaled) image surface, in pixels. */
export interface LaidOutPoint {
  photo: PhotoDto;
  /** Pixel x on the image surface (xPercent * imageWidth). */
  x: number;
  /** Pixel y on the image surface (yPercent * imageHeight). */
  y: number;
}

/** A render unit: either a single pin or an aggregate bubble. */
export interface Cluster {
  /** Stable id: the single photo id, or `cluster:<first-photo-id>`. */
  id: string;
  /** Cluster centroid x on the image surface, in pixels. */
  x: number;
  /** Cluster centroid y on the image surface, in pixels. */
  y: number;
  /** Member points (length 1 → render a pin; >1 → render a count bubble). */
  members: LaidOutPoint[];
}

/**
 * Compute the active screen-pixel merge threshold for a given zoom scale.
 * Inverse to scale (Q6), floored so it never reaches zero.
 */
export function clusterThresholdPx(scale: number): number {
  const safeScale = scale > 0 ? scale : 1;
  return Math.max(
    CLUSTER_TUNING.MIN_THRESHOLD_PX,
    CLUSTER_TUNING.BASE_THRESHOLD_PX / safeScale,
  );
}

/**
 * Lay out photos onto the image surface (percent → pixel). Out-of-range or
 * non-finite coordinates are clamped to [0, 1] defensively (bad seed data
 * shouldn't push a pin off-canvas).
 */
export function layOutPoints(
  photos: readonly PhotoDto[],
  imageWidth: number,
  imageHeight: number,
): LaidOutPoint[] {
  return photos.map((photo) => {
    const px = clamp01(photo.xPercent);
    const py = clamp01(photo.yPercent);
    return { photo, x: px * imageWidth, y: py * imageHeight };
  });
}

/**
 * Greedy-agglomerate laid-out points into clusters at the given zoom scale.
 *
 * The merge distance is measured in SCREEN pixels, so we compare image-surface
 * distances against `threshold / scale` (image-space) — equivalently the
 * on-screen distance against `threshold`. A point joins the first existing
 * cluster whose centroid is within range; centroids are recomputed as members
 * are added so a cluster's anchor tracks its members.
 */
export function clusterPoints(
  points: readonly LaidOutPoint[],
  scale: number,
): Cluster[] {
  const thresholdScreenPx = clusterThresholdPx(scale);
  // Convert the screen-pixel threshold to image-surface pixels: the surface is
  // magnified by `scale`, so a fixed on-screen gap spans fewer surface pixels
  // as you zoom in.
  const safeScale = scale > 0 ? scale : 1;
  const thresholdSurfacePx = thresholdScreenPx / safeScale;
  const thresholdSq = thresholdSurfacePx * thresholdSurfacePx;

  const clusters: Cluster[] = [];

  for (const point of points) {
    let merged = false;
    for (const cluster of clusters) {
      const dx = cluster.x - point.x;
      const dy = cluster.y - point.y;
      if (dx * dx + dy * dy <= thresholdSq) {
        cluster.members.push(point);
        // Recompute centroid incrementally.
        const n = cluster.members.length;
        cluster.x += (point.x - cluster.x) / n;
        cluster.y += (point.y - cluster.y) / n;
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({
        id: point.photo.id,
        x: point.x,
        y: point.y,
        members: [point],
      });
    }
  }

  // Give multi-member clusters a distinct, stable id so React keys don't clash
  // with the single-pin case (member[0].id is reused as the pin id).
  for (const cluster of clusters) {
    if (cluster.members.length > 1) cluster.id = `cluster:${cluster.members[0]!.photo.id}`;
  }

  return clusters;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

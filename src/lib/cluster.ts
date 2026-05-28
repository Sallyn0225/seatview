// Annotation-point clustering for the seatmap (R3.5 / R3.6 / Open Question Q6).
//
// Points are clustered by image-surface proximity, and the threshold shrinks
// quickly as the user zooms in: two pins that overlap at scale 1 pull apart and
// become individually clickable as you zoom. This is what makes the "click
// cluster → zoom in → it explodes into single pins" flow work (ADR-4).
//
// Algorithm: build a distance graph and return its connected components. O(n²)
// worst case, but n is a single sub-map's point count (tens, not thousands) so
// this is fine for the MVP. If a sub-map ever holds 100s of points we'd swap in
// a spatial grid (noted in frontend-libraries.md performance checkpoints).
//
// All magic numbers live in CLUSTER_TUNING so Q6 ("initial 75px/scale, tune
// after seeing it") stays localized.

import type { PhotoDto } from "@/lib/photos";

export const CLUSTER_TUNING = {
  /**
   * Base merge distance in image-surface pixels at scale 1. Before the minimum
   * floor applies, the effective surface threshold is
   * `BASE_THRESHOLD_PX / scale²`: low zoom strongly groups close seat marks,
   * while high zoom quickly separates them for clicking.
   */
  BASE_THRESHOLD_PX: 75,
  /**
   * Floor for the first-stage threshold returned by `clusterThresholdPx`.
   * `clusterPoints` still divides by scale before comparing image-surface
   * distances, so at extreme zoom the effective surface threshold is
   * `MIN_THRESHOLD_PX / scale`.
   */
  MIN_THRESHOLD_PX: 2,
} as const;

/** A point laid out on the (unscaled) image surface, in real chart pixels. */
export interface LaidOutPoint {
  photo: PhotoDto;
  /** Real pixel x on the chart image (xPercent * imageWidth — xPercent is now
   *  image-content-relative, so this is a true pixel position). */
  x: number;
  /** Real pixel y on the chart image (yPercent * imageHeight). */
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
 * Compute the first-stage merge threshold for a given zoom scale. This value is
 * floored by `MIN_THRESHOLD_PX`; `clusterPoints` divides it by scale again to
 * compare image-surface distances.
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
 * Group laid-out points into connected components at the given zoom scale.
 *
 * The merge distance is compared in image-surface pixels. Any chain of points
 * where each adjacent pair is within threshold becomes one cluster, so a dense
 * row cannot be split by centroid drift or input order.
 */
export function clusterPoints(
  points: readonly LaidOutPoint[],
  scale: number,
): Cluster[] {
  const safeScale = scale > 0 ? scale : 1;
  const thresholdSurfacePx = clusterThresholdPx(safeScale) / safeScale;
  const thresholdSq = thresholdSurfacePx * thresholdSurfacePx;

  const parent = points.map((_, index) => index);
  const find = (index: number): number => {
    const root = parent[index];
    if (root === undefined) return index;
    if (root === index) return index;
    const next = find(root);
    parent[index] = next;
    return next;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    for (let j = i + 1; j < points.length; j += 1) {
      const b = points[j]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy <= thresholdSq) union(i, j);
    }
  }

  const groups = new Map<number, LaidOutPoint[]>();
  for (let index = 0; index < points.length; index += 1) {
    const root = find(index);
    const group = groups.get(root);
    if (group) {
      group.push(points[index]!);
    } else {
      groups.set(root, [points[index]!]);
    }
  }

  return Array.from(groups.values())
    .map((members) => {
      members.sort((a, b) => a.photo.id.localeCompare(b.photo.id));
      const x =
        members.reduce((sum, member) => sum + member.x, 0) / members.length;
      const y =
        members.reduce((sum, member) => sum + member.y, 0) / members.length;
      const first = members[0]!;
      return {
        id: members.length > 1 ? `cluster:${first.photo.id}` : first.photo.id,
        x,
        y,
        members,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

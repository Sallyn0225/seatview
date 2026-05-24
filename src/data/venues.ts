import type { Venue } from "@/types";
import { regions, type Prefecture, type Region } from "./prefectures";

// Static venue metadata bundled from data/venues/*.json at build time (ADR-1).
// Maintainers add venues via GitHub PR (R13); the glob picks them up with no
// code changes. eager:true so the full set is available for Fuse.js search.
const modules = import.meta.glob<{ default: Venue }>(
  "../../data/venues/*.json",
  {
    eager: true,
  },
);

export const venues: Venue[] = Object.values(modules)
  .map((m) => m.default)
  // Stable display order so the tree / search results are deterministic across
  // builds regardless of filesystem glob ordering.
  .sort((a, b) => a.id.localeCompare(b.id));

/** Look up a single venue by its url-safe id. */
export function getVenue(id: string): Venue | undefined {
  return venues.find((v) => v.id === id);
}

/** All venues in a given prefecture, in display order. */
export function getVenuesByPrefecture(prefectureSlug: string): Venue[] {
  return venues.filter((v) => v.prefecture === prefectureSlug);
}

/** Set of prefecture slugs that currently have at least one venue. */
export function prefecturesWithVenues(): Set<string> {
  return new Set(venues.map((v) => v.prefecture));
}

/** A prefecture branch in the venue tree, carrying its venues. */
export interface PrefectureNode {
  prefecture: Prefecture;
  venues: Venue[];
}

/** A region branch in the venue tree, carrying populated prefectures. */
export interface RegionNode {
  region: Region;
  prefectures: PrefectureNode[];
}

/**
 * Build the left venue tree (R1): regions → prefectures → venues.
 *
 * By default only prefectures that actually have venues are emitted, so the
 * tree is not flooded with 47 empty branches in the MVP (shape-venue-page
 * decision: "有数据的区划默认展开"). Pass `includeEmpty: true` to render the
 * full administrative hierarchy (e.g. for an "all regions" browse mode).
 */
export function buildVenueTree(
  options: { includeEmpty?: boolean } = {},
): RegionNode[] {
  const { includeEmpty = false } = options;

  const nodes: RegionNode[] = [];
  for (const region of regions) {
    const prefectureNodes: PrefectureNode[] = [];
    for (const prefecture of region.prefectures) {
      const inPrefecture = getVenuesByPrefecture(prefecture.slug);
      if (inPrefecture.length === 0 && !includeEmpty) continue;
      prefectureNodes.push({ prefecture, venues: inPrefecture });
    }
    if (prefectureNodes.length === 0 && !includeEmpty) continue;
    nodes.push({ region, prefectures: prefectureNodes });
  }
  return nodes;
}

export type { Prefecture, Region } from "./prefectures";

// Sub-map selection contract (R3.3 + routing design).
//
// The active sub-map is carried in the URL query (`?tab=<sub-map-id>`) rather
// than the path, so renaming a sub-map never breaks shared/path links
// (prd.md routing design). Multi-image venues switch between sub-maps with
// flat tags; single-map venues default to their one sub-map and render no tabs.
//
// Switching is client-side (history.replaceState, no full reload) and
// broadcast via a custom event so the seatmap (step 4) and photo grid (step 5)
// islands can re-fetch / re-render for the new sub-map without prop drilling
// across island boundaries.

import type { SubMap } from "@/types";

export const SUBMAP_QUERY_PARAM = "tab";
export const SUBMAP_CHANGE_EVENT = "seatview:submap-change";

export interface SubMapChangeDetail {
  /** The newly active sub-map id. */
  subMapId: string;
}

/** Read the active sub-map id from a URL's query, if present and valid. */
export function readSubMapFromUrl(
  url: URL,
  subMaps: readonly SubMap[],
): string | undefined {
  const requested = url.searchParams.get(SUBMAP_QUERY_PARAM);
  if (requested && subMaps.some((s) => s.id === requested)) return requested;
  return undefined;
}

/**
 * Resolve the sub-map to show on entry (R3.2): the requested one if valid,
 * otherwise the first sub-map. Every venue has length >= 1 sub-maps, but we
 * stay defensive for the empty edge.
 */
export function resolveInitialSubMapId(
  subMaps: readonly SubMap[],
  requested: string | undefined,
): string | undefined {
  if (requested && subMaps.some((s) => s.id === requested)) return requested;
  return subMaps[0]?.id;
}

/**
 * Switch the active sub-map: sync the URL query (no reload) and broadcast the
 * change to listening islands. Safe to call only on the client.
 */
export function setActiveSubMap(subMapId: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(SUBMAP_QUERY_PARAM, subMapId);
  window.history.replaceState(null, "", url.toString());
  window.dispatchEvent(
    new CustomEvent<SubMapChangeDetail>(SUBMAP_CHANGE_EVENT, {
      detail: { subMapId },
    }),
  );
}

// Shared Fuse.js config for venue-name matching, used by BOTH the top
// VenueSearch (R2) and the staging-area dedup hint (issue #3) so the two rank
// venues identically (code-reuse-thinking-guide — one source of truth for "what
// counts as a match"). Keep the options + the multi-token query builder here;
// callers own their own result cap.

import type { Expression, IFuseOptions } from "fuse.js";
import type { Venue } from "@/types";

/**
 * Fuse options per R2.3/R2.4:
 *   • multi-field across name_zh / name_jp / name_romaji / prefecture / city /
 *     aliases[]
 *   • ignoreLocation → word order irrelevant
 *   • threshold ~0.4 → fuzzy but not noisy
 *   • useExtendedSearch → enables the per-token AND query built below
 */
export const VENUE_FUSE_OPTIONS: IFuseOptions<Venue> = {
  keys: ["name_zh", "name_jp", "name_romaji", "prefecture", "city", "aliases"],
  ignoreLocation: true,
  threshold: 0.4,
  useExtendedSearch: true,
};

/**
 * Build the per-token AND extended-search query so multi-keyword input is
 * order-independent ("K Arena 横滨" == "横滨 K Arena"): each whitespace-separated
 * token must match at least one field. Pass the result straight to `fuse.search`.
 */
export function venueExtendedQuery(query: string): Expression {
  const keys = VENUE_FUSE_OPTIONS.keys as string[];
  const tokens = query.trim().split(/\s+/);
  return {
    $and: tokens.map((token) => ({
      $or: keys.map((key) => ({ [key]: `'${token}` })),
    })),
  };
}

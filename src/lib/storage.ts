// Centralized localStorage keys + tiny typed accessors.
//
// Single source of truth so islands and inline scripts never drift on key
// spelling. Keys follow the `seatview:*` namespace locked in the shape briefs
// (shape-venue-page.md §11). All reads are SSR-safe (guarded on `window`).

export const STORAGE_KEYS = {
  /** Last-visited venue id — the error-page "back to last venue" link reads this
   *  (LastVenueLink). The home page no longer auto-redirects on it. */
  lastVenue: "seatview:last-venue",
  /** Theme tri-state: 'light' | 'dark' | 'system' (R12.3). */
  theme: "theme",
  /** Persisted locale preference. */
  locale: "seatview:locale",
  /** Venue-tree expanded region/prefecture slugs (session-scoped feel). */
  treeExpanded: "seatview:lang-tree-expanded",
  /** Desktop venue-tree scroll offset, preserved across venue-page reloads. */
  treeScrollTop: "seatview:venue-tree-scroll-top",
} as const;

/** SSR-safe localStorage read. Returns null on the server or on access error. */
export function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** SSR-safe localStorage write. No-op on the server or on access error. */
export function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Record the last-visited venue. The value is consumed by the error pages'
 *  "back to last venue" link (LastVenueLink); the home page no longer redirects
 *  on it. (The venue page currently writes the key via an inline script.) */
export function rememberLastVenue(venueId: string): void {
  writeStorage(STORAGE_KEYS.lastVenue, venueId);
}

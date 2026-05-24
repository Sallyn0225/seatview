// Centralized localStorage keys + tiny typed accessors.
//
// Single source of truth so islands and inline scripts never drift on key
// spelling. Keys follow the `seatview:*` namespace locked in the shape briefs
// (shape-venue-page.md §11). All reads are SSR-safe (guarded on `window`).

export const STORAGE_KEYS = {
  /** Last-visited venue id (R10.2) — home redirect reads this. */
  lastVenue: "seatview:last-venue",
  /** Theme tri-state: 'light' | 'dark' | 'system' (R12.3). */
  theme: "theme",
  /** Persisted locale preference. */
  locale: "seatview:locale",
  /** Venue-tree expanded region/prefecture slugs (session-scoped feel). */
  treeExpanded: "seatview:lang-tree-expanded",
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

/** Record the last-visited venue so the home page can jump straight in (R10.2). */
export function rememberLastVenue(venueId: string): void {
  writeStorage(STORAGE_KEYS.lastVenue, venueId);
}

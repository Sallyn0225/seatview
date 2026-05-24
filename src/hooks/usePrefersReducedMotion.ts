import { useSyncExternalStore } from "react";

// `prefers-reduced-motion` as a tear-free React value.
//
// The seatmap uses this to decide between the animated cluster zoom/explode
// (ADR-4) and an instant jump (shape-seatmap-component §7 reduced-motion
// downgrade). SSR always reports `false` (no animation assumed) which matches
// the static first paint; the client reconciles on hydration.

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** True when the user has requested reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

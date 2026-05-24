// Cross-component "selected photo" signal — the load-bearing contract that
// stitches the seatmap (step 4), the photo grid (step 5) and the Lightbox
// (step 6) together without a heavyweight global store.
//
// Why a vanilla pub/sub instead of React context?
// Each interactive piece is a SEPARATE Astro island with its own React root
// (the seatmap, the grid, the future Lightbox). They cannot share a React
// context across island boundaries, so the shared selection state lives in a
// plain module-level store that any island can subscribe to. This is the
// state-management convention for cross-island signals in this project.
//
// Contract (consumed by steps 4/5/6 — do not change the shape lightly):
//   • Lightbox opens (from a seatmap pin OR a grid card)
//       → call `setSelectedPhoto(photoId)`.
//   • The seatmap subscribes and switches the matching annotation pin to its
//     `selected` visual state (vermilion solid fill + ink hairline — see
//     shape-seatmap-component.md §3.2).
//   • The photo grid subscribes and switches the matching card to `selected`
//     (brightness -5% + medium caption — see shape-photo-grid.md §6).
//   • In sequence mode the Lightbox re-emits on every page turn so the seatmap
//     pin tracks the visible photo (shape-lightbox.md §7).
//   • Lightbox closes → call `setSelectedPhoto(null)`.
//
// `photoId` is the D1 `photos.id` (ulid). `null` means nothing is selected.

export type SelectedPhotoId = string | null;

type Listener = (id: SelectedPhotoId) => void;

let current: SelectedPhotoId = null;
const listeners = new Set<Listener>();

/** Current selected photo id (null when the Lightbox is closed). */
export function getSelectedPhoto(): SelectedPhotoId {
  return current;
}

/**
 * Set the selected photo and notify all subscribers. Callers: the Lightbox on
 * open / page-turn / close. No-op if the value is unchanged.
 */
export function setSelectedPhoto(id: SelectedPhotoId): void {
  if (id === current) return;
  current = id;
  for (const listener of listeners) listener(current);
}

/**
 * Subscribe to selection changes. Returns an unsubscribe function — wire it to
 * a React `useEffect` cleanup so islands don't leak listeners on unmount.
 */
export function subscribeSelectedPhoto(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

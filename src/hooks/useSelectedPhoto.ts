import { useSyncExternalStore } from "react";
import {
  getSelectedPhoto,
  subscribeSelectedPhoto,
  type SelectedPhotoId,
} from "@/lib/selected-photo";

/**
 * React-island binding for the cross-island selected-photo signal
 * (see src/lib/selected-photo.ts). The seatmap (step 4) and photo grid
 * (step 5) call this to know which pin / card should render its `selected`
 * state when the Lightbox (step 6) opens.
 *
 * Uses `useSyncExternalStore` so the value is correct during SSR (always null,
 * matching the closed-Lightbox initial render) and tear-free on the client.
 */
export function useSelectedPhoto(): SelectedPhotoId {
  return useSyncExternalStore(
    subscribeSelectedPhoto,
    getSelectedPhoto,
    () => null,
  );
}

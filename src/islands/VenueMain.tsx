import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { useSelectedPhoto } from "@/hooks/useSelectedPhoto";
import type { Venue } from "@/types";
import {
  resolveInitialSubMapId,
  setActiveSubMap,
  SUBMAP_CHANGE_EVENT,
  type SubMapChangeDetail,
} from "@/lib/submap";
import type { PhotoDto } from "@/lib/photos";
import { dispatchPhotoCountChange } from "@/lib/photos";
import { fetchSubMapPhotos } from "@/lib/photos-client";
import { setSelectedPhoto } from "@/lib/selected-photo";
import Seatmap from "@/islands/Seatmap.tsx";
import PhotoGrid, { type OpenSequencePayload } from "@/islands/PhotoGrid.tsx";
import SeatViewLightbox, {
  type LightboxRequest,
} from "@/islands/SeatViewLightbox.tsx";
import UploadSheet from "@/islands/upload/UploadSheet.tsx";
import { cn } from "@/lib/utils";

interface VenueMainProps {
  locale: Locale;
  venue: Venue;
  initialSubMapId?: string;
  /**
   * Annotation points for the initial sub-map, queried SSR (R3.4) so the first
   * paint needs zero client requests. Switching sub-maps re-fetches via
   * GET /api/photos.
   */
  initialPhotos?: PhotoDto[];
  /**
   * Photo id from a `?photo=` share deep link (resolved + validated SSR). When
   * set, the lightbox auto-opens this photo (single mode) once on mount.
   */
  initialOpenPhotoId?: string;
}

/** First grid batch size (mirrors PhotoGrid's GRID_BATCH); used to decide the
 *  SSR `initialHasMore` probe from the full SSR point set. */
const GRID_FIRST_BATCH = 24;

interface LocateTarget {
  photoId: string;
  token: number;
}

/**
 * Venue main column below the title: seating chart + upload button + photo
 * grid + the shared Lightbox.
 *   • step 4 → seating chart island (shape-seatmap-component.md)
 *   • step 5 → photo grid (shape-photo-grid.md) + Lightbox (shape-lightbox.md)
 *   • step 6 → upload Sheet (shape-upload-sheet.md) opens from the upload button
 *
 * Co-located in ONE island on purpose: the seatmap, grid and Lightbox all read
 * the cross-island `selectedPhotoId` signal and react to sub-map switches, so a
 * single React root keeps the wiring simple. The Lightbox is one instance with
 * two modes (shape-lightbox.md §7):
 *   • seatmap pin click → single mode (look at THIS seat, no paging)
 *   • grid card click   → sequence mode (browse this sub-map, left/right paging)
 */
export default function VenueMain({
  locale,
  venue,
  initialSubMapId,
  initialPhotos = [],
  initialOpenPhotoId,
}: VenueMainProps) {
  const { t } = useLocale(locale);

  const initialActiveId = resolveInitialSubMapId(
    venue.subMaps,
    initialSubMapId,
  );

  // Active sub-map, kept in sync with SubMapTabs via the broadcast event.
  const [activeSubMapId, setActiveSubMapId] = useState<string | undefined>(
    () => initialActiveId,
  );

  // Full annotation set for the active sub-map (the seatmap needs ALL points to
  // cluster). Seeded with the SSR set; re-fetched on sub-map change.
  const [photos, setPhotos] = useState<PhotoDto[]>(initialPhotos);
  const [photosSubMapId, setPhotosSubMapId] = useState<string | undefined>(
    initialActiveId,
  );
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState(false);
  // Tracks the currently intended client fetch. A request id is needed because
  // retrying the same sub-map can otherwise make an older response look fresh.
  const photosRequestSeqRef = useRef(0);
  const photosRequestRef = useRef<{
    id: number;
    subMapId: string;
  } | null>(null);

  useEffect(() => {
    function onChange(event: Event) {
      const detail = (event as CustomEvent<SubMapChangeDetail>).detail;
      if (detail?.subMapId) setActiveSubMapId(detail.subMapId);
    }
    window.addEventListener(SUBMAP_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SUBMAP_CHANGE_EVENT, onChange);
  }, []);

  // Fetch the full point set for a sub-map. Reused by the sub-map-change effect
  // and the seatmap's <LoadFailure> retry (error-pages §4). The request ref
  // keeps same-sub-map retries loading until the active request settles.
  const loadPoints = useCallback(
    (subMapId: string) => {
      const requestId = photosRequestSeqRef.current + 1;
      photosRequestSeqRef.current = requestId;
      photosRequestRef.current = { id: requestId, subMapId };

      const isCurrentRequest = () =>
        photosRequestRef.current?.id === requestId &&
        photosRequestRef.current.subMapId === subMapId;

      setPhotosLoading(true);
      fetchSubMapPhotos(venue.id, subMapId)
        .then((next) => {
          if (!isCurrentRequest()) return;
          setPhotos(next);
          setPhotosSubMapId(subMapId);
          dispatchPhotoCountChange({
            venueId: venue.id,
            subMapId,
            count: next.length,
          });
          setPhotosError(false);
          photosRequestRef.current = null;
          setPhotosLoading(false);
        })
        .catch(() => {
          if (!isCurrentRequest()) return;
          setPhotos([]);
          setPhotosSubMapId(subMapId);
          setPhotosError(true);
          photosRequestRef.current = null;
          setPhotosLoading(false);
        });
    },
    [venue.id],
  );

  // Re-fetch the full point set when the active sub-map changes (R3.3). Skips
  // the first run for the SSR-seeded sub-map to avoid a double fetch.
  useEffect(() => {
    if (!activeSubMapId) return;
    if (activeSubMapId === photosSubMapId) {
      if (photosRequestRef.current?.subMapId === activeSubMapId) return;
      photosRequestRef.current = null;
      if (photosLoading) setPhotosLoading(false);
      return;
    }
    if (
      photosLoading &&
      photosRequestRef.current?.subMapId === activeSubMapId
    ) {
      return;
    }
    loadPoints(activeSubMapId);
  }, [activeSubMapId, photosLoading, photosSubMapId, loadPoints]);

  // Seatmap <LoadFailure> retry → re-run the active sub-map's point fetch.
  const handleRetryPoints = useCallback(() => {
    if (activeSubMapId) loadPoints(activeSubMapId);
  }, [activeSubMapId, loadPoints]);

  // The selected-photo signal (driven by the Lightbox). Both the seatmap pin and
  // the grid card light up their `selected` state from this single value.
  const selectedPhotoId = useSelectedPhoto();

  const activeSubMap =
    venue.subMaps.find((s) => s.id === activeSubMapId) ?? venue.subMaps[0];
  const photosMatchActive = activeSubMap?.id === photosSubMapId;
  const activePhotos = photosMatchActive ? photos : [];
  const activePhotosLoading = photosLoading || !photosMatchActive;

  // ── Lightbox: one instance, two modes ─────────────────────────────────────
  const [lightboxRequest, setLightboxRequest] =
    useState<LightboxRequest | null>(null);
  const [locateTarget, setLocateTarget] = useState<LocateTarget | null>(null);

  // Seatmap pin → SINGLE mode (look at this seat). The full point set lives in
  // `photos`; find the clicked one and open with just it (no paging).
  const handleOpenLightbox = useCallback(
    (photoId: string) => {
      const photo = activePhotos.find((p) => p.id === photoId);
      if (!photo) return;
      setLightboxRequest({ mode: "single", photos: [photo], index: 0 });
    },
    [activePhotos],
  );

  // Grid card → SEQUENCE mode (browse this sub-map). The grid hands over the
  // photos it has loaded so the Lightbox can page left/right across them.
  const handleOpenSequence = useCallback((payload: OpenSequencePayload) => {
    setLightboxRequest({
      mode: "sequence",
      photos: payload.photos,
      index: payload.index,
    });
  }, []);

  const handleCloseLightbox = useCallback(() => setLightboxRequest(null), []);

  const handleLocatePhoto = useCallback((photoId: string) => {
    setSelectedPhoto(photoId);
    setLightboxRequest(null);
    setLocateTarget((prev) => ({
      photoId,
      token: (prev?.token ?? 0) + 1,
    }));
  }, []);

  // Share deep link: open the linked photo once on mount (single mode — "look at
  // THIS view"). SSR aligned the initial sub-map to the photo's, so it is already
  // in `initialPhotos`. The ref guards against re-opening after the user closes.
  const didOpenInitialRef = useRef(false);
  useEffect(() => {
    if (didOpenInitialRef.current || !initialOpenPhotoId) return;
    const photo = initialPhotos.find((p) => p.id === initialOpenPhotoId);
    if (!photo) return;
    didOpenInitialRef.current = true;
    // Canonicalize `?tab=` to the linked photo's sub-map so a stale/renamed tab
    // self-heals in the tabs UI too — the SSR already aligned the seatmap/grid,
    // but SubMapTabs reads `?tab=` from the URL. Multi-map venues only (single-
    // map venues render no tabs). Broadcasts so the tabs underline follows.
    if (venue.subMaps.length > 1) setActiveSubMap(photo.subMapId);
    setLightboxRequest({ mode: "single", photos: [photo], index: 0 });
  }, [initialOpenPhotoId, initialPhotos, venue.subMaps]);

  // ── Upload Sheet (step 6, shape-upload-sheet.md) ───────────────────────────
  // The upload is always attributed to the CURRENT active sub-map (R4.2 —
  // transparent to the user, no explicit picker). Both the upload button below
  // and the grid's empty-state CTA open the Sheet.
  const [uploadOpen, setUploadOpen] = useState(false);
  // Bumping this remounts the grid so it re-fetches `/api/photos` (newest first,
  // R3.9) after a successful upload, surfacing the new card at the top.
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  const handleRequestUpload = useCallback(() => {
    if (!activeSubMap) return;
    setUploadOpen(true);
  }, [activeSubMap]);

  const handleCloseUpload = useCallback(() => setUploadOpen(false), []);

  // A new photo landed (D1 write done). Prepend it to the full point set so the
  // seatmap shows the new pin immediately, and bump the grid key so the grid
  // re-pulls newest-first from the API (also picks up anyone else's uploads).
  const handleUploaded = useCallback((photo: PhotoDto) => {
    setPhotosSubMapId(photo.subMapId);
    setPhotos((prev) =>
      prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev],
    );
    dispatchPhotoCountChange({
      venueId: photo.venueId,
      subMapId: photo.subMapId,
      delta: 1,
    });
    setGridRefreshKey((k) => k + 1);
  }, []);

  // No client-side disable: the 10/day cap is enforced server-side (R8.1) and
  // surfaced as an inline error inside the Sheet's Step 5, not by greying the
  // entry button (the user may still be browsing under the cap).
  const uploadDisabled = false;

  return (
    <div className="space-y-6">
      {activeSubMap ? (
        <Seatmap
          locale={locale}
          subMap={activeSubMap}
          photos={activePhotos}
          loading={activePhotosLoading}
          error={photosMatchActive && photosError && !photosLoading}
          selectedPhotoId={selectedPhotoId}
          locateTarget={locateTarget}
          onOpenLightbox={handleOpenLightbox}
          onRetry={handleRetryPoints}
        />
      ) : null}

      {/* Upload button between seating chart and grid (R4.1). The only place
          vermilion is allowed on this page outside the seatmap pins — a tinted
          fill at ≤10% area (shape-venue-page decision 1). */}
      <div className="flex justify-center">
        <button
          type="button"
          disabled={uploadDisabled}
          onClick={handleRequestUpload}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-md px-6 text-sm font-medium",
            "bg-accent/10 text-foreground border-accent/30 border",
            "transition-colors duration-150",
            "hover:bg-accent/15 hover:border-accent/50",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-label={uploadDisabled ? t.upload.disabled : t.upload.cta}
        >
          <Plus className="size-4" aria-hidden="true" />
          {uploadDisabled ? t.upload.disabled : t.upload.cta}
        </button>
      </div>

      {/* Photo grid. Seeded with the SSR full set for the initial sub-map (the
          grid paginates further itself). `initialHasMore` tells it whether the
          SSR set already covers everything. Keyed on the sub-map so a switch
          remounts cleanly with a fresh load. */}
      {activeSubMap ? (
        <PhotoGrid
          // Remount on sub-map switch OR after an upload so the freshest
          // newest-first page loads (R3.9). gridRefreshKey only changes on the
          // active sub-map's upload.
          key={`${activeSubMap.id}:${gridRefreshKey}`}
          locale={locale}
          venueId={venue.id}
          subMapId={activeSubMap.id}
          initialPhotos={
            activeSubMap.id === initialActiveId && gridRefreshKey === 0
              ? initialPhotos.slice(0, GRID_FIRST_BATCH)
              : []
          }
          initialHasMore={
            activeSubMap.id === initialActiveId && gridRefreshKey === 0
              ? initialPhotos.length > GRID_FIRST_BATCH
              : true
          }
          selectedPhotoId={selectedPhotoId}
          onOpenSequence={handleOpenSequence}
          onRequestUpload={handleRequestUpload}
        />
      ) : null}

      <SeatViewLightbox
        locale={locale}
        venue={venue}
        request={lightboxRequest}
        onClose={handleCloseLightbox}
        onLocate={handleLocatePhoto}
      />

      {/* Upload Sheet (step 6). Mounted only while open so the compression lib
          + Turnstile script aren't loaded until the user contributes. */}
      {uploadOpen && activeSubMap ? (
        <UploadSheet
          locale={locale}
          venue={venue}
          subMap={activeSubMap}
          onClose={handleCloseUpload}
          onUploaded={handleUploaded}
        />
      ) : null}
    </div>
  );
}

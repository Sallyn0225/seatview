// Maintainer admin console island (R7, ADR-11).
//
// Two tabs — uploaded photos moderation + staging-area triage — both fronted by
// Cloudflare Access at the edge (this island carries no auth of its own; if the
// edge ever lets an unauthenticated request through, the API returns 403 and the
// island shows its unauthorized copy). Deliberately the SIMPLEST internal tool
// (task: "最简实现即可") while still守 Restrained / Flat-Folio: neutral surfaces,
// no shadows-as-decoration, no glassmorphism. The one destructive accent is the
// inline confirm bar (no native `confirm()`, no modal — inline, dismissible),
// matching the upload Sheet's inline-confirm pattern.
//
// Visuals: photo delete + staging delete are destructive → ink outline buttons
// turning to a `text-destructive` confirm (vermilion is reserved for the public
// contribution surfaces, NOT this internal tool). LoadFailure is reused for a
// whole-page list failure.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import { relativeTime, absoluteDate, fillTemplate } from "@/lib/format";
import { imageKeyToUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";
import LoadFailure from "@/components/LoadFailure";
import {
  ADMIN_PHOTOS_BATCH,
  ADMIN_STAGING_BATCH,
  type AdminPhotoDto,
} from "@/lib/admin";
import type { StagingVenueDto } from "@/lib/staging";
import {
  AdminError,
  deleteAdminPhoto,
  deleteAdminStaging,
  fetchAdminPhotos,
  fetchAdminStaging,
  setAdminStagingProcessed,
} from "@/lib/admin-client";

/** Static venue/sub-map display labels, resolved on the page (no D1) and passed
 *  in so a photo row can show readable names instead of raw slugs. */
export interface VenueLabel {
  name: string;
  subMaps: Record<string, string>;
}
export type VenueLabels = Record<string, VenueLabel>;

interface AdminConsoleProps {
  locale: Locale;
  /** Authenticated maintainer email (from Cf-Access header / dev mock). */
  email: string;
  /** Base URL for R2 public images (PUBLIC_R2_BASE_URL), for thumbnails. */
  r2BaseUrl: string;
  /** venueId → { name, subMaps } display map, built from static venue data. */
  venueLabels: VenueLabels;
}

type Tab = "photos" | "staging";

export default function AdminConsole({
  locale,
  email,
  r2BaseUrl,
  venueLabels,
}: AdminConsoleProps) {
  const { t } = useLocale(locale);
  const [tab, setTab] = useState<Tab>("photos");

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-foreground font-serif text-2xl">{t.admin.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm [overflow-wrap:anywhere]">
          {fillTemplate(t.admin.signedInAs, { email })}
        </p>
      </header>

      {/* Flat tabs (mirror the venue page sub-map tabs: underline current, no
          pill, no shadow). */}
      <div
        role="tablist"
        aria-label={t.admin.title}
        className="border-border mb-6 flex gap-6 border-b"
      >
        <TabButton
          active={tab === "photos"}
          onClick={() => setTab("photos")}
          label={t.admin.photosTab}
        />
        <TabButton
          active={tab === "staging"}
          onClick={() => setTab("staging")}
          label={t.admin.stagingTab}
        />
      </div>

      {tab === "photos" ? (
        <PhotosPanel
          locale={locale}
          r2BaseUrl={r2BaseUrl}
          venueLabels={venueLabels}
        />
      ) : (
        <StagingPanel locale={locale} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring -mb-px rounded-sm border-b-2 pb-2 text-sm focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-foreground text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      {label}
    </button>
  );
}

/* ── Photos panel ─────────────────────────────────────────────────────────── */

function PhotosPanel({
  locale,
  r2BaseUrl,
  venueLabels,
}: {
  locale: Locale;
  r2BaseUrl: string;
  venueLabels: VenueLabels;
}) {
  const { t } = useLocale(locale);
  const [photos, setPhotos] = useState<AdminPhotoDto[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const loadPage = useCallback(() => {
    if (loadingRef.current || (!hasMore && loaded)) return;
    loadingRef.current = true;
    setError(false);
    const offset = offsetRef.current;
    fetchAdminPhotos(offset, ADMIN_PHOTOS_BATCH, includeDeleted)
      .then(({ photos: next, hasMore: more }) => {
        offsetRef.current = offset + next.length;
        setHasMore(more);
        setPhotos((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of next) if (!ids.has(p.id)) merged.push(p);
          return merged;
        });
        setLoaded(true);
        loadingRef.current = false;
      })
      .catch(() => {
        loadingRef.current = false;
        setError(true);
      });
  }, [hasMore, loaded, includeDeleted]);

  // Reset + reload when the includeDeleted filter flips.
  useEffect(() => {
    offsetRef.current = 0;
    setPhotos([]);
    setHasMore(true);
    setLoaded(false);
    loadingRef.current = false;
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeDeleted]);

  const onDeleted = useCallback((id: string) => {
    setPhotos((prev) =>
      // Keep the row visible (now flagged deleted) when auditing; otherwise drop.
      prev.map((p) => (p.id === id ? { ...p, deleted: true } : p)),
    );
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || error || !loaded) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, error, loaded, loadPage]);

  return (
    <section aria-label={t.admin.photosTab}>
      <label className="text-muted-foreground mb-4 inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeDeleted}
          onChange={(e) => setIncludeDeleted(e.target.checked)}
          className="accent-foreground size-4"
        />
        {t.admin.showDeleted}
      </label>

      {loaded && photos.length === 0 && !error ? (
        <p className="text-muted-foreground/80 mt-8 text-center text-sm">
          {t.admin.photosEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {photos.map((p) => (
            <PhotoRow
              key={p.id}
              photo={p}
              locale={locale}
              r2BaseUrl={r2BaseUrl}
              venueLabels={venueLabels}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      )}

      {error ? (
        <LoadFailure
          locale={locale}
          onRetry={() => {
            loadingRef.current = false;
            loadPage();
          }}
          className="mt-6 rounded-md"
        />
      ) : hasMore ? (
        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      ) : photos.length > 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t.admin.end}
        </p>
      ) : null}
    </section>
  );
}

function PhotoRow({
  photo,
  locale,
  r2BaseUrl,
  venueLabels,
  onDeleted,
}: {
  photo: AdminPhotoDto;
  locale: Locale;
  r2BaseUrl: string;
  venueLabels: VenueLabels;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLocale(locale);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const venue = venueLabels[photo.venueId];
  const venueName = venue?.name ?? photo.venueId;
  const subMapName = venue?.subMaps[photo.subMapId] ?? photo.subMapId;
  const thumb = imageKeyToUrl(photo.imageKey, r2BaseUrl);

  const doDelete = useCallback(async () => {
    setWorking(true);
    setRowError(null);
    try {
      await deleteAdminPhoto(photo.id);
      onDeleted(photo.id);
      setConfirming(false);
    } catch (err) {
      const code = err instanceof AdminError ? err.code : "server_error";
      setRowError(
        code === "unauthorized" ? t.admin.unauthorized : t.admin.actionError,
      );
    } finally {
      setWorking(false);
    }
  }, [photo.id, onDeleted, t]);

  return (
    <li className="border-border flex gap-3 rounded-md border p-3">
      {/* Thumbnail: object-cover small box; broken image shows the box (no
          shimmer). */}
      <img
        src={thumb}
        alt={fillTemplate(t.admin.thumbAlt, { label: photo.seatLabel })}
        width={56}
        height={56}
        loading="lazy"
        className="bg-card size-14 shrink-0 rounded-sm object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium break-words">
          {photo.seatLabel}
          {photo.deleted && (
            <span className="text-muted-foreground ml-2 text-xs">
              · {t.admin.deletedBadge}
            </span>
          )}
        </p>
        <p className="text-muted-foreground text-xs break-words">
          {venueName} · {subMapName}
        </p>
        <time
          dateTime={new Date(photo.createdAt).toISOString()}
          title={absoluteDate(photo.createdAt, locale)}
          className="text-muted-foreground text-xs [font-variant-numeric:tabular-nums]"
        >
          {relativeTime(photo.createdAt, locale)}
        </time>
        {rowError && (
          <p className="text-destructive mt-1 text-xs" role="alert">
            {rowError}
          </p>
        )}
      </div>

      {/* Delete action — only for not-already-deleted rows. Inline confirm bar
          (no native confirm, no modal). */}
      {!photo.deleted &&
        (confirming ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-muted-foreground max-w-44 text-right text-xs leading-snug">
              {t.admin.confirmDeletePhoto}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={doDelete}
                disabled={working}
                className={cn(
                  "border-destructive text-destructive inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
                  "hover:bg-destructive/10 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {working ? t.admin.working : t.admin.confirmYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={working}
                className="border-border text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-3 text-xs focus-visible:ring-2 focus-visible:outline-none"
              >
                {t.admin.confirmNo}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`${t.admin.deletePhoto} ${photo.seatLabel}`}
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground focus-visible:ring-ring inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {t.admin.deletePhoto}
          </button>
        ))}
    </li>
  );
}

/* ── Staging panel ────────────────────────────────────────────────────────── */

function StagingPanel({ locale }: { locale: Locale }) {
  const { t } = useLocale(locale);
  const [venues, setVenues] = useState<StagingVenueDto[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const loadPage = useCallback(() => {
    if (loadingRef.current || (!hasMore && loaded)) return;
    loadingRef.current = true;
    setError(false);
    const offset = offsetRef.current;
    fetchAdminStaging(offset, ADMIN_STAGING_BATCH)
      .then(({ venues: next, hasMore: more }) => {
        offsetRef.current = offset + next.length;
        setHasMore(more);
        setVenues((prev) => {
          const ids = new Set(prev.map((v) => v.id));
          const merged = [...prev];
          for (const v of next) if (!ids.has(v.id)) merged.push(v);
          return merged;
        });
        setLoaded(true);
        loadingRef.current = false;
      })
      .catch(() => {
        loadingRef.current = false;
        setError(true);
      });
  }, [hasMore, loaded]);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onProcessedChange = useCallback((id: string, processed: boolean) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === id ? { ...v, processed } : v)),
    );
  }, []);
  const onDeleted = useCallback((id: string) => {
    setVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || error || !loaded) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, error, loaded, loadPage]);

  return (
    <section aria-label={t.admin.stagingTab}>
      {loaded && venues.length === 0 && !error ? (
        <p className="text-muted-foreground/80 mt-8 text-center text-sm">
          {t.admin.stagingEmpty}
        </p>
      ) : (
        <ul>
          {venues.map((v) => (
            <StagingAdminRow
              key={v.id}
              venue={v}
              locale={locale}
              onProcessedChange={onProcessedChange}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      )}

      {error ? (
        <LoadFailure
          locale={locale}
          onRetry={() => {
            loadingRef.current = false;
            loadPage();
          }}
          className="mt-6 rounded-md"
        />
      ) : hasMore ? (
        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      ) : venues.length > 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t.admin.end}
        </p>
      ) : null}
    </section>
  );
}

function StagingAdminRow({
  venue,
  locale,
  onProcessedChange,
  onDeleted,
}: {
  venue: StagingVenueDto;
  locale: Locale;
  onProcessedChange: (id: string, processed: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLocale(locale);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const toggleProcessed = useCallback(async () => {
    setWorking(true);
    setRowError(null);
    const next = !venue.processed;
    try {
      await setAdminStagingProcessed(venue.id, next);
      onProcessedChange(venue.id, next);
    } catch (err) {
      const code = err instanceof AdminError ? err.code : "server_error";
      setRowError(
        code === "unauthorized" ? t.admin.unauthorized : t.admin.actionError,
      );
    } finally {
      setWorking(false);
    }
  }, [venue.id, venue.processed, onProcessedChange, t]);

  const doDelete = useCallback(async () => {
    setWorking(true);
    setRowError(null);
    try {
      await deleteAdminStaging(venue.id);
      onDeleted(venue.id);
    } catch (err) {
      const code = err instanceof AdminError ? err.code : "server_error";
      setRowError(
        code === "unauthorized" ? t.admin.unauthorized : t.admin.actionError,
      );
      setWorking(false);
    }
  }, [venue.id, onDeleted, t]);

  return (
    <li className="border-border flex flex-col gap-2 border-b py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <span className="text-foreground text-sm break-words">
          {venue.name}
        </span>
        {venue.processed && (
          <span className="text-muted-foreground ml-2 text-xs">
            ✓ {t.admin.processed}
          </span>
        )}
        {rowError && (
          <p className="text-destructive mt-1 text-xs" role="alert">
            {rowError}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-baseline gap-3">
        <time
          dateTime={new Date(venue.createdAt).toISOString()}
          title={absoluteDate(venue.createdAt, locale)}
          className="text-muted-foreground text-xs [font-variant-numeric:tabular-nums]"
        >
          {relativeTime(venue.createdAt, locale)}
        </time>

        <button
          type="button"
          onClick={toggleProcessed}
          disabled={working}
          className="border-border text-muted-foreground hover:text-foreground hover:border-foreground focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working
            ? t.admin.working
            : venue.processed
              ? t.admin.markUnprocessed
              : t.admin.markProcessed}
        </button>

        {confirming ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={doDelete}
              disabled={working}
              className="border-destructive text-destructive hover:bg-destructive/10 focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? t.admin.working : t.admin.confirmYes}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={working}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t.admin.confirmNo}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`${t.admin.deleteStaging} ${venue.name}`}
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground focus-visible:ring-ring inline-flex h-8 items-center rounded-md border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {t.admin.deleteStaging}
          </button>
        )}
      </div>
    </li>
  );
}

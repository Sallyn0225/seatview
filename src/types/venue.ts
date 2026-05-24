// Core domain types for SeatView.
//
// Single source of truth — these types are shared across frontend islands,
// Astro pages and Worker API routes. Do NOT re-declare them elsewhere
// (see .trellis/spec/frontend/type-safety.md).

/**
 * A single seating chart variant for a venue. Single-chart venues still
 * carry exactly one default sub-map.
 */
export interface SubMap {
  /** url-safe slug, e.g. "L3-center". */
  id: string;
  /** Tab label (Simplified Chinese). */
  label_zh: string;
  /** Tab label (Japanese). */
  label_jp: string;
  /** Seating chart image URL (R2 public bucket / static asset). */
  imageUrl: string;
  /** Original image width in px, for percent ↔ pixel coordinate conversion. */
  width: number;
  /** Original image height in px. */
  height: number;
}

/**
 * Venue metadata. Authored as static JSON/TS in the Git repo (ADR-1),
 * bundled into the client for zero-latency Fuse.js search.
 */
export interface Venue {
  /** url-safe slug, e.g. "k-arena-yokohama". */
  id: string;
  name_zh: string;
  name_jp: string;
  name_romaji: string;
  /** Prefecture slug, e.g. "kanagawa" / "overseas". */
  prefecture: string;
  city: string;
  aliases: string[];
  /** length >= 1. */
  subMaps: SubMap[];
}

/**
 * A user-uploaded seat view: an annotation point on a sub-map plus its photo.
 * Mirrors the D1 `photos` table (see src/server/db/schema.ts).
 */
export interface Photo {
  /** ulid. */
  id: string;
  venueId: string;
  subMapId: string;
  /** Normalized annotation coordinate, 0.0 ~ 1.0. */
  xPercent: number;
  /** Normalized annotation coordinate, 0.0 ~ 1.0. */
  yPercent: number;
  /** R2 object key. */
  imageKey: string;
  /** Intrinsic pixel width of the stored WebP (real aspect ratio for masonry). */
  width: number;
  /** Intrinsic pixel height of the stored WebP. */
  height: number;
  /** Required free-text seat label. */
  seatLabel: string;
  /** ISO date, optional. */
  performanceDate: string | null;
  eventName: string | null;
  description: string | null;
  /** Unix epoch ms. */
  createdAt: number;
}

/**
 * A staging-area venue suggestion submitted by a regular user (R6).
 * Mirrors the D1 `staging_venues` table.
 */
export interface StagingVenue {
  /** ulid. */
  id: string;
  /** Free-text venue name. */
  name: string;
  /** Unix epoch ms. */
  createdAt: number;
}

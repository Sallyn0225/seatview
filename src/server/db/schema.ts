// Drizzle schema for Cloudflare D1 (see prd.md Data Model).
//
// Only user-generated content lives in D1; venue metadata is static JSON/TS in
// the Git repo (ADR-1). `created_at` / `deleted_at` are Unix epoch ms integers.
import {
  sqliteTable,
  text,
  real,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Annotation point + uploaded seat-view photo. */
export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(), // ulid
    venueId: text("venue_id").notNull(),
    subMapId: text("sub_map_id").notNull(),
    xPercent: real("x_percent").notNull(), // 0.0 ~ 1.0
    yPercent: real("y_percent").notNull(), // 0.0 ~ 1.0
    imageKey: text("image_key").notNull(), // R2 object key
    // Intrinsic pixel dimensions of the stored WebP (after client compression).
    // Persisted so the masonry grid + Lightbox lay out at the photo's REAL
    // aspect ratio — no cropping, no CLS (shape-photo-grid.md §10). Captured
    // client-side at compress time, bound into the signed upload ticket so the
    // client cannot tamper with them, then written from the ticket here.
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    seatLabel: text("seat_label").notNull(), // required
    performanceDate: text("performance_date"), // ISO date, optional
    eventName: text("event_name"), // optional
    description: text("description"), // optional
    ipHash: text("ip_hash").notNull(), // hashed IP, never raw
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"), // soft delete (ADR-6)
  },
  (table) => [
    index("idx_photos_venue").on(
      table.venueId,
      table.subMapId,
      table.deletedAt,
    ),
  ],
);

/** Staging-area venue suggestion (R6). */
export const stagingVenues = sqliteTable("staging_venues", {
  id: text("id").primaryKey(), // ulid
  name: text("name").notNull(),
  ipHash: text("ip_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  processedAt: integer("processed_at"), // maintainer marked processed
  // Denormalized "+1" tally, kept in sync with `staging_votes` rows in the same
  // D1 batch as each vote insert (so sort/display is one indexable column, not a
  // per-row aggregate). Every venue carries ≥1: the submitter auto-counts as the
  // first +1 (PRD decision — 提交即首票).
  voteCount: integer("vote_count").notNull().default(0),
});

/**
 * One "+1" (附议) on a staging suggestion. A demand signal for maintainers, not
 * a social like — the public count is rendered restrained (no vermilion).
 *
 * `UNIQUE(venue_id, ip_hash)` enforces permanent dedup: one IP can +1 a given
 * venue exactly once, ever (a duplicate +1 is an idempotent no-op). The daily
 * "5 different venues" cap is a COUNT(DISTINCT venue_id) over today's rows for
 * an ip_hash — relational, so this lives in D1 rather than the KV rate-limiter.
 * `ip_hash` is the salted hash (never the raw IP) and is never sent to clients.
 */
export const stagingVotes = sqliteTable(
  "staging_votes",
  {
    id: text("id").primaryKey(), // ulid
    venueId: text("venue_id").notNull(),
    ipHash: text("ip_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_staging_votes_unique").on(table.venueId, table.ipHash),
    // Daily distinct-venue limit query: WHERE ip_hash = ? AND created_at >= ?.
    index("idx_staging_votes_ip").on(table.ipHash, table.createdAt),
  ],
);

/**
 * One anonymous 1..5-star rating of a collected venue (task 06-10-giscus).
 * The rated venue is a STATIC venue id (data/venues/*.json, ADR-1), validated
 * against the bundled set at the API layer — D1 has no venues table to FK.
 *
 * `UNIQUE(venue_id, ip_hash)` makes the rating per-IP-per-venue: a repeat
 * submission is a score CHANGE (UPSERT), never a second row, so one IP can
 * never inflate the count. `ip_hash` is the salted hash (server/ip.ts), never
 * the raw IP, and is never sent to clients.
 */
export const venueRatings = sqliteTable(
  "venue_ratings",
  {
    id: text("id").primaryKey(), // ulid
    venueId: text("venue_id").notNull(),
    score: integer("score").notNull(), // 1..5, validated at the API layer
    ipHash: text("ip_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at"), // last score change, null = never changed
  },
  (table) => [
    uniqueIndex("idx_venue_ratings_dedup").on(table.venueId, table.ipHash),
  ],
);

/**
 * Denormalized rating aggregate, 1 row per rated venue. The display path (venue
 * page SSR) reads exactly this row — never `AVG()` over `venue_ratings` (D1
 * bills rows read; same reasoning as `stagingVenues.voteCount`). Kept in sync
 * with `venue_ratings` in the SAME `db.batch` as every rating write (atomic).
 * `rating_sum` is an integer so `avg = sum / count` avoids stored floats.
 */
export const venueRatingAgg = sqliteTable("venue_rating_agg", {
  venueId: text("venue_id").primaryKey(),
  ratingCount: integer("rating_count").notNull().default(0),
  ratingSum: integer("rating_sum").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

/** Anonymous request to correct one uploaded photo's seat label. */
export const photoCorrectionRequests = sqliteTable(
  "photo_correction_requests",
  {
    id: text("id").primaryKey(), // ulid
    photoId: text("photo_id").notNull(),
    currentSeatLabel: text("current_seat_label").notNull(),
    requestedSeatLabel: text("requested_seat_label").notNull(),
    ipHash: text("ip_hash").notNull(),
    // Pending-only uniqueness guard. Set to a stable key while pending, then
    // cleared on approval/rejection so a future correction can be submitted.
    activeDedupKey: text("active_dedup_key"),
    createdAt: integer("created_at").notNull(),
    processedAt: integer("processed_at"),
    approvedAt: integer("approved_at"),
  },
  (table) => [
    uniqueIndex("idx_photo_corrections_active_dedup").on(table.activeDedupKey),
    index("idx_photo_corrections_pending").on(
      table.processedAt,
      table.createdAt,
    ),
    index("idx_photo_corrections_photo").on(table.photoId),
  ],
);

export type PhotoRow = typeof photos.$inferSelect;
export type NewPhotoRow = typeof photos.$inferInsert;
export type StagingVenueRow = typeof stagingVenues.$inferSelect;
export type NewStagingVenueRow = typeof stagingVenues.$inferInsert;
export type StagingVoteRow = typeof stagingVotes.$inferSelect;
export type NewStagingVoteRow = typeof stagingVotes.$inferInsert;
export type PhotoCorrectionRequestRow =
  typeof photoCorrectionRequests.$inferSelect;
export type NewPhotoCorrectionRequestRow =
  typeof photoCorrectionRequests.$inferInsert;
export type VenueRatingRow = typeof venueRatings.$inferSelect;
export type NewVenueRatingRow = typeof venueRatings.$inferInsert;
export type VenueRatingAggRow = typeof venueRatingAgg.$inferSelect;

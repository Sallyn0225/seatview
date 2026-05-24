// Drizzle schema for Cloudflare D1 (see prd.md Data Model).
//
// Only user-generated content lives in D1; venue metadata is static JSON/TS in
// the Git repo (ADR-1). `created_at` / `deleted_at` are Unix epoch ms integers.
import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

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
});

export type PhotoRow = typeof photos.$inferSelect;
export type NewPhotoRow = typeof photos.$inferInsert;
export type StagingVenueRow = typeof stagingVenues.$inferSelect;
export type NewStagingVenueRow = typeof stagingVenues.$inferInsert;

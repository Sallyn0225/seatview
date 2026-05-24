-- Initial SeatView schema (see prd.md Data Model).
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`sub_map_id` text NOT NULL,
	`x_percent` real NOT NULL,
	`y_percent` real NOT NULL,
	`image_key` text NOT NULL,
	`seat_label` text NOT NULL,
	`performance_date` text,
	`event_name` text,
	`description` text,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_photos_venue` ON `photos` (`venue_id`,`sub_map_id`,`deleted_at`);
--> statement-breakpoint
CREATE TABLE `staging_venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`processed_at` integer
);

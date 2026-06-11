CREATE TABLE `venue_rating_agg` (
	`venue_id` text PRIMARY KEY NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`rating_sum` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venue_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`score` integer NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_venue_ratings_dedup` ON `venue_ratings` (`venue_id`,`ip_hash`);
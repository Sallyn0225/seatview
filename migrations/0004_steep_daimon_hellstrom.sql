CREATE TABLE `photo_correction_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`current_seat_label` text NOT NULL,
	`requested_seat_label` text NOT NULL,
	`ip_hash` text NOT NULL,
	`active_dedup_key` text,
	`created_at` integer NOT NULL,
	`processed_at` integer,
	`approved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_photo_corrections_active_dedup` ON `photo_correction_requests` (`active_dedup_key`);--> statement-breakpoint
CREATE INDEX `idx_photo_corrections_pending` ON `photo_correction_requests` (`processed_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_photo_corrections_photo` ON `photo_correction_requests` (`photo_id`);
CREATE TABLE `staging_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_staging_votes_unique` ON `staging_votes` (`venue_id`,`ip_hash`);--> statement-breakpoint
CREATE INDEX `idx_staging_votes_ip` ON `staging_votes` (`ip_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `staging_venues` ADD `vote_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: pre-existing suggestions predate the +1 feature; treat each as its
-- submitter's first +1 so no venue renders a cold 0 (PRD 提交即首票). These rows
-- have no matching staging_votes row, so their original submitter could still +1
-- once (count → 2) — an accepted low-probability edge (PRD Technical Approach).
UPDATE `staging_venues` SET `vote_count` = 1 WHERE `vote_count` = 0;
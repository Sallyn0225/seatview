ALTER TABLE `venue_ratings` ADD `view_score` integer;
ALTER TABLE `venue_ratings` ADD `sound_score` integer;
ALTER TABLE `venue_ratings` ADD `amenities_score` integer;
ALTER TABLE `venue_ratings` ADD `transit_score` integer;
ALTER TABLE `venue_rating_agg` ADD `dimension_rating_count` integer DEFAULT 0 NOT NULL;
ALTER TABLE `venue_rating_agg` ADD `view_rating_sum` integer DEFAULT 0 NOT NULL;
ALTER TABLE `venue_rating_agg` ADD `sound_rating_sum` integer DEFAULT 0 NOT NULL;
ALTER TABLE `venue_rating_agg` ADD `amenities_rating_sum` integer DEFAULT 0 NOT NULL;
ALTER TABLE `venue_rating_agg` ADD `transit_rating_sum` integer DEFAULT 0 NOT NULL;

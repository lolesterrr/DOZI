CREATE TABLE `xp_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`study_day` text NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`amount` integer NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `xp_events_owner_day_idx` ON `xp_events` (`owner_id`,`study_day`);--> statement-breakpoint
CREATE INDEX `xp_events_source_idx` ON `xp_events` (`source`,`source_id`);
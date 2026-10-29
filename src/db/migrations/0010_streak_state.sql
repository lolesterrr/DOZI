CREATE TABLE `streak_state` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`longest` integer DEFAULT 0 NOT NULL,
	`last_counted_day` text,
	`freezes_held` integer DEFAULT 0 NOT NULL,
	`repair_available_until` text,
	`last_repair_day` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);

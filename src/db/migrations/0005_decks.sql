CREATE TABLE `card_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`sub_key` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `card_instances_card_sub_idx` ON `card_instances` (`card_id`,`sub_key`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`deck_id` text NOT NULL,
	`type` text NOT NULL,
	`front_json` text NOT NULL,
	`back_json` text NOT NULL,
	`extra_json` text,
	`front_text` text DEFAULT '' NOT NULL,
	`back_text` text DEFAULT '' NOT NULL,
	`occlusion_json` text,
	`topic_id` text,
	`drug_id` text,
	`source_note_id` text,
	`suspended` integer DEFAULT false NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `cards_owner_idx` ON `cards` (`owner_id`);--> statement-breakpoint
CREATE INDEX `cards_deck_idx` ON `cards` (`deck_id`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`folder_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`topic_id` text,
	`source` text DEFAULT 'user' NOT NULL,
	`forked_from` text,
	`official_deck_id` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`share_code` text,
	`pinned` integer DEFAULT false NOT NULL,
	`new_per_day` integer DEFAULT 15 NOT NULL,
	`max_reviews_per_day` integer DEFAULT 200 NOT NULL,
	`desired_retention` real DEFAULT 0.9 NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `decks_owner_idx` ON `decks` (`owner_id`);--> statement-breakpoint
CREATE INDEX `decks_folder_idx` ON `decks` (`folder_id`);
CREATE TABLE `note_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `note_versions_note_idx` ON `note_versions` (`note_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`folder_id` text,
	`title` text DEFAULT '' NOT NULL,
	`content_json` text NOT NULL,
	`content_text` text DEFAULT '' NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`topic_id` text,
	`drug_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`template` text,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `notes_owner_idx` ON `notes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `notes_folder_idx` ON `notes` (`folder_id`);
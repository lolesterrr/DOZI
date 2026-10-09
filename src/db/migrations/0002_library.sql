CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`parent_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `folders_owner_kind_idx` ON `folders` (`owner_id`,`kind`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `item_tags` (
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text,
	PRIMARY KEY(`item_type`, `item_id`, `tag_id`)
);
--> statement-breakpoint
CREATE INDEX `item_tags_tag_idx` ON `item_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`colour` text DEFAULT 'teal' NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `tags_owner_idx` ON `tags` (`owner_id`);
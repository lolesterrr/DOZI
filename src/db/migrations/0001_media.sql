CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`local_uri` text,
	`remote_path` text,
	`mime` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`upload_status` text DEFAULT 'local' NOT NULL,
	`derived_from` text,
	`annotation_json` text,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `media_owner_idx` ON `media` (`owner_id`);
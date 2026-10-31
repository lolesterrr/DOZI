CREATE TABLE `timetable_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`timetable_id` text NOT NULL,
	`title` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'lecture' NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`lecturer` text DEFAULT '' NOT NULL,
	`colour` text DEFAULT 'teal' NOT NULL,
	`reminders_json` text DEFAULT '[]' NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `timetable_classes_owner_idx` ON `timetable_classes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `timetable_classes_timetable_idx` ON `timetable_classes` (`timetable_id`);--> statement-breakpoint
CREATE TABLE `timetables` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `timetables_owner_idx` ON `timetables` (`owner_id`);
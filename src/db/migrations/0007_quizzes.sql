CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`source` text DEFAULT 'user' NOT NULL,
	`official_id` text,
	`type` text NOT NULL,
	`stem_json` text NOT NULL,
	`stem_text` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`explanation_json` text,
	`difficulty` integer DEFAULT 2 NOT NULL,
	`topic_id` text,
	`drug_ids_json` text DEFAULT '[]' NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `questions_owner_idx` ON `questions` (`owner_id`);--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`quiz_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 1 NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text,
	PRIMARY KEY(`quiz_id`, `question_id`)
);
--> statement-breakpoint
CREATE INDEX `quiz_questions_question_idx` ON `quiz_questions` (`question_id`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`folder_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`topic_id` text,
	`settings_json` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`share_code` text,
	`pinned` integer DEFAULT false NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `quizzes_owner_idx` ON `quizzes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `quizzes_folder_idx` ON `quizzes` (`folder_id`);
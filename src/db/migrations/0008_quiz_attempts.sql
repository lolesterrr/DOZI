CREATE TABLE `question_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`response_json` text,
	`score` real DEFAULT 0 NOT NULL,
	`max_score` real DEFAULT 0 NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`time_ms` integer DEFAULT 0 NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `question_responses_attempt_idx` ON `question_responses` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `question_responses_question_idx` ON `question_responses` (`question_id`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`quiz_id` text,
	`context` text DEFAULT 'quiz' NOT NULL,
	`context_id` text,
	`mode` text NOT NULL,
	`settings_json` text NOT NULL,
	`retry_of` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`score` real DEFAULT 0 NOT NULL,
	`max_score` real DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT true NOT NULL,
	`_synced_at` text
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_owner_idx` ON `quiz_attempts` (`owner_id`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_quiz_idx` ON `quiz_attempts` (`quiz_id`);
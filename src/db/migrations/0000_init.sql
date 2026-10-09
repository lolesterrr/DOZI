CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`year_of_study` integer,
	`semester` integer,
	`cohort_code` text,
	`timezone` text DEFAULT 'Africa/Kampala' NOT NULL,
	`daily_goal_xp` integer DEFAULT 50 NOT NULL,
	`reminder_time` text,
	`role` text DEFAULT 'student' NOT NULL,
	`auth_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);

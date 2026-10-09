import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ARCHITECTURE §3.2 — the local profile and local-only settings.

export const profileRoles = ['student', 'reviewer', 'admin'] as const;
export type ProfileRole = (typeof profileRoles)[number];

/**
 * One row per device: the person using the app. Created on first launch with a random UUID;
 * `auth_user_id` is filled in when they sign in (Phase 3).
 */
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  yearOfStudy: integer('year_of_study'),
  semester: integer('semester'),
  cohortCode: text('cohort_code'),
  timezone: text('timezone').notNull().default('Africa/Kampala'),
  dailyGoalXp: integer('daily_goal_xp').notNull().default(50),
  /** Local time of the daily reminder, "HH:mm", or null for no reminder. */
  reminderTime: text('reminder_time'),
  role: text('role', { enum: profileRoles }).notNull().default('student'),
  authUserId: text('auth_user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/** Local-only UI preferences and app state (never synced). Values are JSON strings. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
});

export type SettingRow = typeof settings.$inferSelect;

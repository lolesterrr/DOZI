import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.4 — the XP ledger (PRODUCT_SPEC §8.1).

/** What earned the XP. The amounts for each are in features/gamification/logic.ts. */
export const xpSources = [
  'review_card',
  'quiz_correct_own',
  'quiz_correct_official',
  'lesson_complete',
  'lesson_all_correct',
  'practice_node',
  'checkpoint_pass',
  'checkpoint_three_stars',
  'mock_exam',
  'card_created',
  'note_created',
  'daily_goal_bonus',
  'error_report_accepted',
] as const;
export type XpSource = (typeof xpSources)[number];

/**
 * One award of XP. Append-only: nothing is ever edited, so totals and levels can always be
 * worked out again from the rows (also after a sync brings rows from another phone).
 */
export const xpEvents = sqliteTable(
  'xp_events',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    /** The study day (`YYYY-MM-DD`, rolls over at 03:00) the XP counts for. */
    studyDay: text('study_day').notNull(),
    source: text('source', { enum: xpSources }).notNull(),
    /** What it was for (a card, a quiz attempt, a note…), so the same thing isn't paid twice. */
    sourceId: text('source_id'),
    amount: integer('amount').notNull(),
    ...syncColumns(),
  },
  (t) => [
    index('xp_events_owner_day_idx').on(t.ownerId, t.studyDay),
    index('xp_events_source_idx').on(t.source, t.sourceId),
  ],
);

export type XpEvent = typeof xpEvents.$inferSelect;
export type NewXpEvent = typeof xpEvents.$inferInsert;

/**
 * The streak as last worked out (PRODUCT_SPEC §8.2): one row per student. It can always be
 * rebuilt from `xp_events` (features/gamification/streak.ts), which is what sync does after a
 * pull; it is kept so reminders and other screens can read it without replaying the history.
 */
export const streakState = sqliteTable('streak_state', {
  ownerId: text('owner_id').primaryKey(),
  current: integer('current').notNull().default(0),
  longest: integer('longest').notNull().default(0),
  /** The last study day that reached 10 XP (`YYYY-MM-DD`). */
  lastCountedDay: text('last_counted_day'),
  freezesHeld: integer('freezes_held').notNull().default(0),
  /** The last study day an open repair can still be finished on, or null. */
  repairAvailableUntil: text('repair_available_until'),
  /** The study day the latest repair was completed on. */
  lastRepairDay: text('last_repair_day'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  ...syncColumns(),
});

export type StreakStateRow = typeof streakState.$inferSelect;

/**
 * Badges the student has unlocked (PRODUCT_SPEC §8.4): one row per badge. Which badges exist and
 * how they unlock is in features/gamification/achievements.ts; this only remembers the unlocks.
 * Rows are never deleted, so a badge stays once earned.
 */
export const achievements = sqliteTable(
  'achievements',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    /** The badge's key, e.g. `card_collector`. */
    key: text('key').notNull(),
    unlockedAt: text('unlocked_at').notNull(),
    ...syncColumns(),
  },
  (t) => [uniqueIndex('achievements_owner_key_idx').on(t.ownerId, t.key)],
);

export type AchievementRow = typeof achievements.$inferSelect;

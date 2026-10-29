import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

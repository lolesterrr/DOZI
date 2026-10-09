import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.3 — FSRS scheduling state and the review history (PRODUCT_SPEC §5.1).
// No foreign keys, like the other user tables: sync may bring a log before its card.

/** Where a card is in FSRS: never seen, in its first short steps, graduated, or relearning. */
export const srsStates = ['new', 'learning', 'review', 'relearning'] as const;
export type SrsState = (typeof srsStates)[number];

/**
 * The current FSRS memory state of one card instance. A missing row means a new card. Can always
 * be rebuilt by replaying the instance's `review_logs` (sync and undo do that).
 */
export const cardState = sqliteTable(
  'card_state',
  {
    cardInstanceId: text('card_instance_id').primaryKey(),
    ...ownedColumns(),
    /** When the card is next due, ISO-8601 UTC. */
    due: text('due').notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    /** Which (re)learning step the card is on (ts-fsrs 5). */
    learningSteps: integer('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: text('state', { enum: srsStates }).notNull().default('new'),
    lastReview: text('last_review'),
    /** "Bury until tomorrow" (task 1.8): hidden until this study day (`YYYY-MM-DD`) begins. */
    buriedUntil: text('buried_until'),
    ...syncColumns(),
  },
  (t) => [index('card_state_owner_due_idx').on(t.ownerId, t.due)],
);

export type CardStateRow = typeof cardState.$inferSelect;
export type NewCardStateRow = typeof cardState.$inferInsert;

/**
 * One answer to one card instance. Append-only: the scheduling fields hold the card's state
 * *before* the answer (as ts-fsrs logs do). Undo soft-deletes the row; nothing else changes it.
 */
export const reviewLogs = sqliteTable(
  'review_logs',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    cardInstanceId: text('card_instance_id').notNull(),
    /** 1 Again · 2 Hard · 3 Good · 4 Easy. */
    rating: integer('rating').notNull(),
    state: text('state', { enum: srsStates }).notNull(),
    due: text('due').notNull(),
    stability: real('stability').notNull(),
    difficulty: real('difficulty').notNull(),
    elapsedDays: integer('elapsed_days').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull().default(0),
    /** How long the student looked at the card before answering (null when unknown). */
    reviewDurationMs: integer('review_duration_ms'),
    reviewedAt: text('reviewed_at').notNull(),
    ...syncColumns(),
  },
  (t) => [
    index('review_logs_instance_idx').on(t.cardInstanceId, t.reviewedAt),
    index('review_logs_owner_day_idx').on(t.ownerId, t.reviewedAt),
  ],
);

export type ReviewLogRow = typeof reviewLogs.$inferSelect;
export type NewReviewLogRow = typeof reviewLogs.$inferInsert;

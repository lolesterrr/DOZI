import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.3 — the question bank and quizzes (PRODUCT_SPEC §4.3).
// No foreign keys, like the other user tables: sync may bring a quiz before its questions.

/**
 * The question types the editor makes so far (task 1.10). The others in PRODUCT_SPEC §4.3
 * (ordering, calculation, LEQ, hotspot, case-based) are added to this list in later tasks; the
 * column has no CHECK constraint, so adding one needs no migration.
 */
export const questionTypes = [
  'sba',
  'mtf',
  'multiple_response',
  'fill_blank',
  'matching',
  'saq',
] as const;
export type QuestionType = (typeof questionTypes)[number];

export const questionSources = ['user', 'official'] as const;
export type QuestionSource = (typeof questionSources)[number];

/**
 * One question in the student's bank (or, from Phase 4, an official one). The stem and the
 * explanation are ProseMirror JSON (images as `media://<id>`), like card fields; everything that
 * depends on the type (options, statements, blanks, pairs, marking points) is in `payload_json`,
 * checked by the zod schemas in `features/quizzes/types.ts`.
 */
export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    // Written out instead of `ownedColumns()`: official questions (Phase 4) have no owner.
    ownerId: text('owner_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
    source: text('source', { enum: questionSources }).notNull().default('user'),
    officialId: text('official_id'),
    type: text('type', { enum: questionTypes }).notNull(),
    stemJson: text('stem_json').notNull(),
    stemText: text('stem_text').notNull().default(''),
    payloadJson: text('payload_json').notNull(),
    /** Null when the student wrote none. */
    explanationJson: text('explanation_json'),
    /** 1 easy · 2 medium · 3 hard. */
    difficulty: integer('difficulty').notNull().default(2),
    topicId: text('topic_id'),
    drugIdsJson: text('drug_ids_json').notNull().default('[]'),
    ...syncColumns(),
  },
  (t) => [index('questions_owner_idx').on(t.ownerId)],
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export const quizVisibilities = ['private', 'link', 'public'] as const;
export type QuizVisibility = (typeof quizVisibilities)[number];

/** A quiz the student built, kept in the Library's Quizzes segment. */
export const quizzes = sqliteTable(
  'quizzes',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    folderId: text('folder_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    topicId: text('topic_id'),
    /** Mode, time limit, shuffling, pass mark, negative marking (`quizSettingsSchema`). */
    settingsJson: text('settings_json').notNull(),
    visibility: text('visibility', { enum: quizVisibilities }).notNull().default('private'),
    shareCode: text('share_code'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    ...syncColumns(),
  },
  (t) => [index('quizzes_owner_idx').on(t.ownerId), index('quizzes_folder_idx').on(t.folderId)],
);

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;

/**
 * Which questions are in which quiz, in what order, worth how many points. A question is in a
 * quiz at most once. Removing it soft-deletes the link (so the removal syncs); adding it back
 * revives the same row, like `item_tags`.
 */
export const quizQuestions = sqliteTable(
  'quiz_questions',
  {
    quizId: text('quiz_id').notNull(),
    questionId: text('question_id').notNull(),
    position: integer('position').notNull().default(0),
    points: integer('points').notNull().default(1),
    ...ownedColumns(),
    ...syncColumns(),
  },
  (t) => [
    primaryKey({ columns: [t.quizId, t.questionId] }),
    index('quiz_questions_question_idx').on(t.questionId),
  ],
);

export type QuizQuestion = typeof quizQuestions.$inferSelect;

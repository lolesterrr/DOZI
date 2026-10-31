import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.9 — the student's own lecture timetables (PRODUCT_SPEC §13).
// No foreign keys, like the other user tables: sync may bring a class before its timetable.

export const classKinds = ['lecture', 'practical', 'tutorial', 'other'] as const;
export type ClassKind = (typeof classKinds)[number];

/** A named weekly timetable, e.g. "Year 2 · Semester 1". The student picks which one is in use. */
export const timetables = sqliteTable(
  'timetables',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    name: text('name').notNull(),
    ...syncColumns(),
  },
  (t) => [index('timetables_owner_idx').on(t.ownerId)],
);

export type Timetable = typeof timetables.$inferSelect;

/** One weekly session of a course: a day, a start and end time, and its reminders. */
export const timetableClasses = sqliteTable(
  'timetable_classes',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    timetableId: text('timetable_id').notNull(),
    /** The course name, e.g. "Pharmacology II". */
    title: text('title').notNull(),
    /** The course code, e.g. "PHA 2101". May be empty. */
    code: text('code').notNull().default(''),
    kind: text('kind', { enum: classKinds }).notNull().default('lecture'),
    /** 1 = Monday … 7 = Sunday. */
    weekday: integer('weekday').notNull(),
    /** Local wall-clock times, "HH:mm". */
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    location: text('location').notNull().default(''),
    lecturer: text('lecturer').notNull().default(''),
    /** A course colour name from `courseColourNames` in src/theme/tokens.ts. */
    colour: text('colour').notNull().default('teal'),
    /** JSON array of reminders (see `reminderSchema` in features/timetable/logic.ts). */
    remindersJson: text('reminders_json').notNull().default('[]'),
    ...syncColumns(),
  },
  (t) => [
    index('timetable_classes_owner_idx').on(t.ownerId),
    index('timetable_classes_timetable_idx').on(t.timetableId),
  ],
);

export type TimetableClass = typeof timetableClasses.$inferSelect;

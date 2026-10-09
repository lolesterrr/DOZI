import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.3 — the student's own notes (PRODUCT_SPEC §4.1).
// No foreign keys, like the Library tables: sync may bring a note before its folder.

/**
 * One note. `content_json` is the editor's ProseMirror JSON (images as `media://<id>`);
 * `content_text` is the same content as plain text, for previews, word count and search (1.4).
 */
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    folderId: text('folder_id'),
    title: text('title').notNull().default(''),
    contentJson: text('content_json').notNull(),
    contentText: text('content_text').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    /** Optional link to a curriculum topic or drug (Phase 2). */
    topicId: text('topic_id'),
    drugId: text('drug_id'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    /** The template the note started from (task 1.4), or null for a blank note. */
    template: text('template'),
    ...syncColumns(),
  },
  (t) => [index('notes_owner_idx').on(t.ownerId), index('notes_folder_idx').on(t.folderId)],
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

/** Earlier versions of a note's content. Local only (never synced); the last 10 are kept. */
export const noteVersions = sqliteTable(
  'note_versions',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id').notNull(),
    contentJson: text('content_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('note_versions_note_idx').on(t.noteId, t.createdAt)],
);

export type NoteVersion = typeof noteVersions.$inferSelect;

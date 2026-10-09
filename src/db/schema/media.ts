import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { ownedColumns, syncColumns } from './sync';

// ARCHITECTURE §3.3 and §5 — images the student adds (photos of slides, diagrams…).

export const mediaUploadStatuses = ['local', 'queued', 'uploading', 'uploaded', 'failed'] as const;
export type MediaUploadStatus = (typeof mediaUploadStatuses)[number];

/**
 * One row per stored image. Rich content refers to it as `media://<id>`, never by file path.
 * The file itself lives in the app's private documents folder (see `features/media/files.ts`).
 */
export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    ...ownedColumns(),
    /**
     * Path of the file **relative to the app's documents folder**, e.g. `media/<id>.jpg`, or null
     * when the file only exists in the cloud. Relative because the absolute folder can change
     * when the app is updated.
     */
    localUri: text('local_uri'),
    /** Supabase Storage path once uploaded (Phase 3). */
    remotePath: text('remote_path'),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    uploadStatus: text('upload_status', { enum: mediaUploadStatuses }).notNull().default('local'),
    /** For an annotated copy (task 1.5): the original media id. */
    derivedFrom: text('derived_from'),
    annotationJson: text('annotation_json'),
    ...syncColumns(),
  },
  (t) => [index('media_owner_idx').on(t.ownerId)],
);

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

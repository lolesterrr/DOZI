import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { media, type Media, type MediaUploadStatus, type NewMedia } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import type { MediaFileRef } from './logic';

type Deps = { newId?: () => string; now?: () => string };

const isoNow = () => nowIso();

export type MediaInput = Omit<
  NewMedia,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'dirty' | 'syncedAt'
>;

/** Saves a new media row. Pass `id` when the file was already named after it. */
export async function insertMedia(
  db: AppDatabase,
  input: MediaInput & { id?: string },
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Media> {
  const timestamp = now();
  const [created] = await db
    .insert(media)
    .values({ ...input, id: input.id ?? newId(), createdAt: timestamp, updatedAt: timestamp })
    .returning();
  return created;
}

/** A media row by id, including soft-deleted ones (old notes may still point at them). */
export async function getMedia(db: AppDatabase, id: string): Promise<Media | undefined> {
  const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return rows[0];
}

/** Every image that hasn't been deleted, newest first. */
export async function listMedia(db: AppDatabase): Promise<Media[]> {
  return db.select().from(media).where(isNull(media.deletedAt)).orderBy(desc(media.createdAt));
}

/** Soft-deletes an image. The file stays for 30 days so the delete can be undone. */
export async function deleteMedia(
  db: AppDatabase,
  id: string,
  { now = isoNow }: Pick<Deps, 'now'> = {},
): Promise<void> {
  const timestamp = now();
  await db
    .update(media)
    .set({ deletedAt: timestamp, updatedAt: timestamp, dirty: true })
    .where(and(eq(media.id, id), isNull(media.deletedAt)));
}

/** Undoes `deleteMedia`. */
export async function restoreMedia(
  db: AppDatabase,
  id: string,
  { now = isoNow }: Pick<Deps, 'now'> = {},
): Promise<void> {
  await db
    .update(media)
    .set({ deletedAt: null, updatedAt: now(), dirty: true })
    .where(eq(media.id, id));
}

/** Total size in bytes of the images stored on this phone (not counting deleted ones). */
export async function storageUsedBytes(db: AppDatabase): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${media.bytes}), 0)` })
    .from(media)
    .where(and(isNull(media.deletedAt), sql`${media.localUri} is not null`));
  return Number(rows[0]?.total ?? 0);
}

/** Every row's file path and delete time — what the orphan clean-up needs. */
export async function listMediaFileRefs(db: AppDatabase): Promise<MediaFileRef[]> {
  return db.select({ localUri: media.localUri, deletedAt: media.deletedAt }).from(media);
}

// ---------------------------------------------------------------------------------------------
// Upload queue and downloads (task 3.5). `upload_status` and `local_uri` describe this phone's
// copy and never sync, so changing them doesn't mark the row dirty.
// ---------------------------------------------------------------------------------------------

/** The student's images that are on this phone but not in the cloud yet, oldest first. */
export async function listUploadQueue(db: AppDatabase, ownerId: string): Promise<Media[]> {
  return db
    .select()
    .from(media)
    .where(
      and(
        eq(media.ownerId, ownerId),
        isNull(media.deletedAt),
        isNull(media.remotePath),
        sql`${media.localUri} is not null`,
      ),
    )
    .orderBy(asc(media.createdAt));
}

export async function setUploadStatus(
  db: AppDatabase,
  ids: readonly string[],
  status: MediaUploadStatus,
): Promise<void> {
  if (ids.length === 0) return;
  await db.update(media).set({ uploadStatus: status }).where(inArray(media.id, ids));
}

/** The file is in the cloud: record where, so other phones can download it (this row syncs). */
export async function markUploaded(
  db: AppDatabase,
  id: string,
  remotePath: string,
  { now = isoNow }: Pick<Deps, 'now'> = {},
): Promise<void> {
  await db
    .update(media)
    .set({ remotePath, uploadStatus: 'uploaded', updatedAt: now(), dirty: true })
    .where(and(eq(media.id, id), isNull(media.remotePath)));
}

/** A cloud image was saved on this phone. */
export async function setLocalFile(
  db: AppDatabase,
  id: string,
  relativePath: string,
): Promise<void> {
  await db
    .update(media)
    .set({ localUri: relativePath, uploadStatus: 'uploaded' })
    .where(eq(media.id, id));
}

/** Images in the cloud whose file this phone doesn't have yet (by row: no local path). */
export async function listCloudOnly(db: AppDatabase, ownerId: string): Promise<Media[]> {
  return db
    .select()
    .from(media)
    .where(
      and(
        eq(media.ownerId, ownerId),
        isNull(media.deletedAt),
        isNull(media.localUri),
        sql`${media.remotePath} is not null`,
      ),
    )
    .orderBy(desc(media.createdAt));
}

export type UploadCounts = { waiting: number; failed: number };

/** For the Account screen: images still to upload, and how many of those failed last time. */
export async function countUploads(db: AppDatabase, ownerId: string): Promise<UploadCounts> {
  const rows = await listUploadQueue(db, ownerId);
  return {
    waiting: rows.length,
    failed: rows.filter((row) => row.uploadStatus === 'failed').length,
  };
}

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { media } from '@/db/schema';
import { createLogger } from '@/lib/logger';

import { compressOnDevice, pickFromDevice } from './device';
import { deviceMediaStore } from './files';
import { addImage, cleanUpIfDue, cleanUpOrphanFiles, type ImageSourceKind } from './pipeline';
import { deleteMedia } from './repo';

const log = createLogger('media');

const deviceDeps = { pick: pickFromDevice, compress: compressOnDevice, files: deviceMediaStore };

/** One media row, kept up to date. `undefined` while loading or if it doesn't exist. */
export function useMedia(id: string) {
  const db = useDatabase();
  const { data } = useLiveQuery(db.select().from(media).where(eq(media.id, id)).limit(1), [id]);
  return data[0];
}

/**
 * Where to load an image from: a local file:// uri, or null if this phone doesn't have the file
 * (downloading from the cloud arrives with sync in Phase 3).
 */
export function useMediaUri(id: string): { uri: string | null; loading: boolean } {
  const row = useMedia(id);
  if (!row) return { uri: null, loading: true };
  return { uri: row.localUri ? deviceMediaStore.resolve(row.localUri) : null, loading: false };
}

/** Every image that hasn't been deleted, newest first. */
export function useMediaList() {
  const db = useDatabase();
  const { data } = useLiveQuery(
    db.select().from(media).where(isNull(media.deletedAt)).orderBy(desc(media.createdAt)),
  );
  return data;
}

/** Bytes used by images stored on this phone. */
export function useStorageUsed(): number {
  const db = useDatabase();
  const { data } = useLiveQuery(
    db
      .select({ total: sql<number>`coalesce(sum(${media.bytes}), 0)` })
      .from(media)
      .where(and(isNull(media.deletedAt), sql`${media.localUri} is not null`)),
  );
  return Number(data[0]?.total ?? 0);
}

/** Returns a function that picks/captures, compresses and saves an image. */
export function useAddImage() {
  const db = useDatabase();
  return useCallback((source: ImageSourceKind) => addImage(db, source, deviceDeps), [db]);
}

/** Returns a function that soft-deletes an image (its file is kept 30 days for undo). */
export function useDeleteMedia() {
  const db = useDatabase();
  return useCallback((id: string) => deleteMedia(db, id), [db]);
}

/** Returns a function that runs the orphan clean-up now (dev screen). */
export function useCleanUpNow() {
  const db = useDatabase();
  return useCallback(() => cleanUpOrphanFiles(db, deviceDeps), [db]);
}

/** Runs the weekly orphan-file clean-up once per app start, if it's due. */
export function useWeeklyMediaCleanup() {
  const db = useDatabase();
  useEffect(() => {
    cleanUpIfDue(db, deviceDeps).catch((error: unknown) =>
      log.warn('Media clean-up failed', { error: String(error) }),
    );
  }, [db]);
}

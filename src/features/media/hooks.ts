import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { media } from '@/db/schema';
import { createLogger } from '@/lib/logger';

import { compressOnDevice, pickFromDevice } from './device';
import { deviceMediaStore } from './files';
import { mediaAvailability, type MediaAvailability } from './logic';
import { addImage, cleanUpIfDue, cleanUpOrphanFiles, type ImageSourceKind } from './pipeline';
import { deleteMedia } from './repo';
import {
  downloadMedia,
  getDownloadState,
  getMediaCloud,
  subscribeDownloads,
  subscribeMediaCloud,
  type DownloadState,
} from './transfer';

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
 * (yet: `useMediaSource` also says whether it can be downloaded).
 */
export function useMediaUri(id: string): { uri: string | null; loading: boolean } {
  const row = useMedia(id);
  if (!row) return { uri: null, loading: true };
  return { uri: row.localUri ? deviceMediaStore.resolve(row.localUri) : null, loading: false };
}

export type MediaSource =
  | { kind: 'loading' }
  | Extract<MediaAvailability, { kind: 'local' | 'missing' }>
  | {
      kind: 'cloud';
      bytes: number;
      /** downloading · failed · waiting (Data saver on mobile data: tap to download). */
      state: DownloadState | 'waiting';
      /** Starts a download now, whatever the connection (the student asked). */
      download: () => void;
    };

/**
 * How to show an image (task 3.5): the phone's file, or a cloud copy that downloads by itself
 * when the connection allows (Data saver), or waits for a tap. Signed out, a cloud-only image is
 * just missing.
 */
export function useMediaSource(id: string): MediaSource {
  const row = useMedia(id);
  const cloud = useSyncExternalStore(subscribeMediaCloud, getMediaCloud);
  const downloadState = useSyncExternalStore(subscribeDownloads, () => getDownloadState(id));
  const [autoTried, setAutoTried] = useState<string | null>(null);

  const available = row
    ? mediaAvailability(row, row.localUri ? deviceMediaStore.resolve(row.localUri) : null)
    : null;
  const inCloud = available?.kind === 'cloud' && !!cloud;

  const download = useCallback(() => {
    if (cloud) void downloadMedia(cloud.db, id, cloud.deps.cloud);
  }, [cloud, id]);

  // Download once by itself if the connection allows it.
  useEffect(() => {
    if (!inCloud || !cloud || autoTried === id || getDownloadState(id)) return;
    let cancelled = false;
    cloud.deps
      .networkAllowed()
      .catch(() => false)
      .then((allowed) => {
        if (cancelled) return;
        setAutoTried(id);
        if (allowed) void downloadMedia(cloud.db, id, cloud.deps.cloud);
      });
    return () => {
      cancelled = true;
    };
  }, [inCloud, cloud, id, autoTried]);

  if (!available) return { kind: 'loading' };
  if (available.kind !== 'cloud') return available;
  if (!cloud) return { kind: 'missing' };
  const state = downloadState ?? (autoTried === id ? 'waiting' : 'downloading');
  return { kind: 'cloud', bytes: available.bytes, state, download };
}

/** Every image that hasn't been deleted, newest first. */
export function useMediaList() {
  const db = useDatabase();
  const { data } = useLiveQuery(
    db.select().from(media).where(isNull(media.deletedAt)).orderBy(desc(media.createdAt)),
  );
  return data;
}

/**
 * The student's pictures still to back up (task 3.5): how many wait, and how many of those
 * failed last time. Kept up to date.
 */
export function useUploadCounts(ownerId: string | undefined): { waiting: number; failed: number } {
  const db = useDatabase();
  const { data } = useLiveQuery(
    db
      .select({ status: media.uploadStatus })
      .from(media)
      .where(
        and(
          eq(media.ownerId, ownerId ?? ''),
          isNull(media.deletedAt),
          isNull(media.remotePath),
          sql`${media.localUri} is not null`,
        ),
      ),
    [ownerId],
  );
  return { waiting: data.length, failed: data.filter((row) => row.status === 'failed').length };
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

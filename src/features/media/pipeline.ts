import type { Media } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getSetting, setSetting } from '@/features/settings/repo';
import { ensureProfile } from '@/features/profile/repo';
import { newId as defaultNewId } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { nowIso, systemClock, type Clock } from '@/lib/time';

import type { MediaFileStore } from './files';
import { findOrphanFiles, formatBytes, isCleanupDue, MEDIA_MIME, percentSaved } from './logic';
import { insertMedia, listMediaFileRefs } from './repo';

// ARCHITECTURE §5 — pick/capture → compress → save → `media` row, plus the weekly clean-up.
// Device APIs come in through `deps` so the whole flow is tested in Jest with fakes.

const log = createLogger('media');

export type ImageSourceKind = 'library' | 'camera';
export type PickedImage = { uri: string; width: number; height: number; bytes?: number };
export type CompressedImage = { uri: string; width: number; height: number };

export type PipelineDeps = {
  pick: (source: ImageSourceKind) => Promise<PickedImage | 'permission-denied' | null>;
  compress: (image: PickedImage) => Promise<CompressedImage>;
  files: MediaFileStore;
  newId?: () => string;
  clock?: Clock;
};

export type AddImageResult =
  | { status: 'saved'; media: Media; beforeBytes: number | null; afterBytes: number }
  | { status: 'cancelled' }
  | { status: 'permission-denied' };

/**
 * Lets the student pick (or take) a photo, compresses it, saves it in the media folder and
 * records it in the `media` table. Logs the size before and after compression.
 */
export async function addImage(
  db: AppDatabase,
  source: ImageSourceKind,
  { pick, compress, files, newId = defaultNewId, clock = systemClock }: PipelineDeps,
): Promise<AddImageResult> {
  const picked = await pick(source);
  if (picked === 'permission-denied') return { status: 'permission-denied' };
  if (!picked) return { status: 'cancelled' };

  const beforeBytes = picked.bytes ?? files.sizeOf(picked.uri);
  const compressed = await compress(picked);
  const id = newId();
  const { relativePath, bytes: afterBytes } = files.adopt(compressed.uri, id);

  const profile = await ensureProfile(db);
  const saved = await insertMedia(
    db,
    {
      id,
      ownerId: profile.id,
      localUri: relativePath,
      mime: MEDIA_MIME,
      width: compressed.width,
      height: compressed.height,
      bytes: afterBytes,
      uploadStatus: 'local',
    },
    { now: () => nowIso(clock) },
  );

  log.info('Saved image', {
    id,
    source,
    before: beforeBytes === null ? 'unknown' : formatBytes(beforeBytes),
    after: formatBytes(afterBytes),
    saved: beforeBytes === null ? 'unknown' : `${percentSaved(beforeBytes, afterBytes)}%`,
    originalSize: `${picked.width}×${picked.height}`,
    savedSize: `${compressed.width}×${compressed.height}`,
  });
  return { status: 'saved', media: saved, beforeBytes, afterBytes };
}

export const LAST_CLEANUP_KEY = 'media.lastCleanupAt';

/** Deletes media files nothing points at any more. Returns how many it removed. */
export async function cleanUpOrphanFiles(
  db: AppDatabase,
  { files, clock = systemClock }: Pick<PipelineDeps, 'files' | 'clock'>,
): Promise<number> {
  const orphans = findOrphanFiles(files.list(), await listMediaFileRefs(db), clock().getTime());
  for (const name of orphans) {
    try {
      files.remove(name);
    } catch (error) {
      log.warn('Could not delete an orphan media file', { name, error: String(error) });
    }
  }
  await setSetting(db, LAST_CLEANUP_KEY, nowIso(clock));
  if (orphans.length > 0) log.info('Cleaned up orphan media files', { count: orphans.length });
  return orphans.length;
}

/** Runs `cleanUpOrphanFiles` if it hasn't run in the last 7 days. Returns null if not due. */
export async function cleanUpIfDue(
  db: AppDatabase,
  deps: Pick<PipelineDeps, 'files' | 'clock'>,
): Promise<number | null> {
  const clock = deps.clock ?? systemClock;
  const last = await getSetting(db, LAST_CLEANUP_KEY);
  if (!isCleanupDue(typeof last === 'string' ? last : undefined, clock().getTime())) return null;
  return cleanUpOrphanFiles(db, deps);
}

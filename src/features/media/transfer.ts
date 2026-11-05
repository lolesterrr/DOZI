import type { AppDatabase } from '@/db/types';
import { isOfflineError } from '@/features/sync/logic';
import { createLogger } from '@/lib/logger';

import { remoteMediaPath } from './logic';
import {
  getMedia,
  listCloudOnly,
  listUploadQueue,
  markUploaded,
  setLocalFile,
  setUploadStatus,
} from './repo';

// Moving image files to and from the cloud (task 3.5, ARCHITECTURE §5). The network and the
// phone's files sit behind `MediaCloud`, so tests use a fake one.

const log = createLogger('media');

export interface MediaCloud {
  /** Uploads the file at `fileUri` (file://) to `remotePath` in the bucket, replacing any copy. */
  upload(remotePath: string, fileUri: string, mime: string): Promise<void>;
  /** Saves the cloud file as this image's file on the phone; returns its relative path. */
  download(remotePath: string, id: string): Promise<string>;
}

/** What uploads and downloads need. */
export type MediaTransferDeps = {
  cloud: MediaCloud;
  /** The phone's file for a stored relative path (file://), or null if it's gone. */
  resolve: (relativePath: string) => string | null;
  /** May images move over the current connection (Data saver)? */
  networkAllowed: () => Promise<boolean>;
  now?: () => string;
};

export type UploadSummary = { uploaded: number; failed: number; waiting: number };

/**
 * Uploads the student's images that aren't in the cloud yet, oldest first. Runs inside a sync,
 * before the rows are pushed, so the new `remote_path` goes up in the same run. With Data saver
 * on and no Wi-Fi the images wait (status `queued`). One image failing doesn't stop the others;
 * losing the connection does (the error goes to the sync's backoff).
 */
export async function uploadPendingMedia(
  db: AppDatabase,
  ownerId: string,
  { cloud, resolve, networkAllowed, now }: MediaTransferDeps,
): Promise<UploadSummary> {
  const queue = await listUploadQueue(db, ownerId);
  if (queue.length === 0) return { uploaded: 0, failed: 0, waiting: 0 };
  if (!(await networkAllowed())) {
    await setUploadStatus(
      db,
      queue.filter((row) => row.uploadStatus === 'local').map((row) => row.id),
      'queued',
    );
    return { uploaded: 0, failed: 0, waiting: queue.length };
  }
  let uploaded = 0;
  let failed = 0;
  for (const row of queue) {
    const fileUri = row.localUri ? resolve(row.localUri) : null;
    if (!fileUri) {
      // The file is gone from this phone, so there's nothing to send.
      await setUploadStatus(db, [row.id], 'failed');
      failed++;
      continue;
    }
    const remotePath = remoteMediaPath(ownerId, row.id);
    await setUploadStatus(db, [row.id], 'uploading');
    try {
      await cloud.upload(remotePath, fileUri, row.mime);
    } catch (error) {
      await setUploadStatus(db, [row.id], 'failed');
      if (isOfflineError(error)) throw error;
      log.warn('Image upload failed', { id: row.id, error: String(error) });
      failed++;
      continue;
    }
    await markUploaded(db, row.id, remotePath, now ? { now } : {});
    uploaded++;
  }
  return { uploaded, failed, waiting: 0 };
}

// ---------------------------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------------------------

export type DownloadState = 'downloading' | 'failed';

const downloads = new Map<string, DownloadState>();
const listeners = new Set<() => void>();

function setDownload(id: string, state: DownloadState | null) {
  if (state) downloads.set(id, state);
  else downloads.delete(id);
  listeners.forEach((listener) => listener());
}

/** Is this image downloading right now, or did its last download fail? */
export function getDownloadState(id: string): DownloadState | null {
  return downloads.get(id) ?? null;
}

export function subscribeDownloads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Saves one cloud image on the phone. A call for an image that is already downloading returns
 * false at once. Returns true when the file is now on the phone.
 */
export async function downloadMedia(
  db: AppDatabase,
  id: string,
  cloud: MediaCloud,
): Promise<boolean> {
  if (downloads.get(id) === 'downloading') return false;
  setDownload(id, 'downloading');
  try {
    const row = await getMedia(db, id);
    if (!row?.remotePath) throw new Error('This image is not in the cloud');
    const relativePath = await cloud.download(row.remotePath, id);
    await setLocalFile(db, id, relativePath);
    setDownload(id, null);
    return true;
  } catch (error) {
    log.warn('Image download failed', { id, error: String(error) });
    setDownload(id, 'failed');
    return false;
  }
}

/**
 * After a sync: saves images that arrived from another phone, newest first, if the connection
 * allows (Data saver). Images left over show "Tap to download" where they appear.
 */
export async function downloadCloudMedia(
  db: AppDatabase,
  ownerId: string,
  { cloud, networkAllowed }: Pick<MediaTransferDeps, 'cloud' | 'networkAllowed'>,
): Promise<number> {
  const rows = await listCloudOnly(db, ownerId);
  if (rows.length === 0 || !(await networkAllowed())) return 0;
  let saved = 0;
  for (const row of rows) {
    if (downloads.get(row.id) === 'downloading') continue;
    if (await downloadMedia(db, row.id, cloud)) saved++;
  }
  return saved;
}

/** For tests: forget download states. */
export function resetDownloadsForTests() {
  downloads.clear();
  listeners.clear();
  active = null;
  activeListeners.clear();
}

// ---------------------------------------------------------------------------------------------
// The signed-in student's cloud, for downloads a screen asks for ("Tap to download")
// ---------------------------------------------------------------------------------------------

let active: { db: AppDatabase; deps: MediaTransferDeps } | null = null;
const activeListeners = new Set<() => void>();

/** Set while a student is signed in and syncing (sync/hooks.ts); null otherwise. */
export function setMediaCloud(next: { db: AppDatabase; deps: MediaTransferDeps } | null) {
  active = next;
  activeListeners.forEach((listener) => listener());
}

export function getMediaCloud() {
  return active;
}

export function subscribeMediaCloud(listener: () => void): () => void {
  activeListeners.add(listener);
  return () => activeListeners.delete(listener);
}

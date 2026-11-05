// Pure rules of the media pipeline (ARCHITECTURE §5). No device APIs here, so it is unit-tested.

/** The longest side of a saved image, in pixels (CLAUDE.md non-negotiable 2). */
export const MEDIA_MAX_EDGE = 1600;
/** JPEG quality used when saving (0–1). */
export const MEDIA_JPEG_QUALITY = 0.7;
export const MEDIA_MIME = 'image/jpeg';
/** Folder (inside the app's documents folder) that holds every media file. */
export const MEDIA_DIR = 'media';

/** How often the orphan clean-up runs. */
export const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Files younger than this are never cleaned up: the pipeline writes the file a moment before it
 * inserts the row, so a brand-new file can look like an orphan.
 */
export const CLEANUP_FILE_GRACE_MS = 60 * 60 * 1000;
/** How long a soft-deleted image keeps its file, so the delete can still be undone. */
export const CLEANUP_DELETED_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export type Size = { width: number; height: number };

/**
 * The size to shrink an image to so its long edge is at most `maxEdge`, keeping the aspect ratio.
 * Returns null when it is already small enough (it is still re-encoded as JPEG).
 */
export function resizeTarget(size: Size, maxEdge: number = MEDIA_MAX_EDGE): Size | null {
  const { width, height } = size;
  if (width <= 0 || height <= 0) return null;
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return null;
  const scale = maxEdge / longEdge;
  return width >= height
    ? { width: maxEdge, height: Math.max(1, Math.round(height * scale)) }
    : { width: Math.max(1, Math.round(width * scale)), height: maxEdge };
}

const MEDIA_SCHEME = 'media://';

/** The reference rich content stores for an image: `media://<id>`. */
export function mediaRef(id: string): string {
  return `${MEDIA_SCHEME}${id}`;
}

/** The media id inside a `media://<id>` reference, or null if it isn't one. */
export function parseMediaRef(ref: string): string | null {
  if (!ref.startsWith(MEDIA_SCHEME)) return null;
  const id = ref.slice(MEDIA_SCHEME.length);
  return /^[A-Za-z0-9-]+$/.test(id) ? id : null;
}

/** The file name for a media id, e.g. `<id>.jpg`. */
export function mediaFileName(id: string): string {
  return `${id}.jpg`;
}

/** The path stored in `media.local_uri`: relative to the documents folder. */
export function mediaRelativePath(id: string): string {
  return `${MEDIA_DIR}/${mediaFileName(id)}`;
}

/** Bytes as a short human-readable size, e.g. "312 KB" or "4.2 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** How much smaller the saved file is than the original, in whole percent (0 if it grew). */
export function percentSaved(beforeBytes: number, afterBytes: number): number {
  if (beforeBytes <= 0 || afterBytes >= beforeBytes) return 0;
  return Math.round((1 - afterBytes / beforeBytes) * 100);
}

/** True when the weekly clean-up hasn't run yet, or last ran a week or more ago. */
export function isCleanupDue(lastRunIso: string | undefined, nowMs: number): boolean {
  if (!lastRunIso) return true;
  const last = Date.parse(lastRunIso);
  if (Number.isNaN(last) || last > nowMs) return true;
  return nowMs - last >= CLEANUP_INTERVAL_MS;
}

export type StoredFile = { name: string; modifiedMs: number | null };
export type MediaFileRef = { localUri: string | null; deletedAt: string | null };

/**
 * The files in the media folder that can be deleted: no media row points at them, or their row
 * was soft-deleted more than 30 days ago. Files written in the last hour are always kept.
 */
export function findOrphanFiles(
  files: readonly StoredFile[],
  rows: readonly MediaFileRef[],
  nowMs: number,
): string[] {
  const keep = new Set<string>();
  for (const row of rows) {
    if (!row.localUri) continue;
    const deletedMs = row.deletedAt ? Date.parse(row.deletedAt) : NaN;
    const expired = !Number.isNaN(deletedMs) && nowMs - deletedMs > CLEANUP_DELETED_GRACE_MS;
    if (!expired) keep.add(fileNameOf(row.localUri));
  }
  return files
    .filter((file) => !keep.has(file.name))
    .filter((file) => file.modifiedMs === null || nowMs - file.modifiedMs > CLEANUP_FILE_GRACE_MS)
    .map((file) => file.name);
}

function fileNameOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

// ---------------------------------------------------------------------------------------------
// Cloud copies (task 3.5, ARCHITECTURE §5)
// ---------------------------------------------------------------------------------------------

/** The private Storage bucket for students' own images (supabase/migrations). */
export const MEDIA_BUCKET = 'user-media';

/** How long a download link stays valid. The file is saved on the phone straight away. */
export const SIGNED_URL_SECONDS = 10 * 60;

/** Where an image lives in Storage: `<owner id>/<media id>.jpg` (the policies check the folder). */
export function remoteMediaPath(ownerId: string, id: string): string {
  return `${ownerId}/${mediaFileName(id)}`;
}

/** What kind of connection the phone has right now. */
export type ConnectionKind = 'wifi' | 'cellular' | 'none' | 'unknown';

/**
 * May images move over this connection without asking? With Data saver ("Wi-Fi only") on, only
 * Wi-Fi counts; an unknown connection is treated like mobile data.
 */
export function mediaNetworkAllowed(wifiOnly: boolean, connection: ConnectionKind): boolean {
  if (connection === 'none') return false;
  if (connection === 'wifi') return true;
  return !wifiOnly;
}

/** How an image can be shown on this phone. */
export type MediaAvailability =
  | { kind: 'local'; uri: string }
  | { kind: 'cloud'; remotePath: string; bytes: number }
  | { kind: 'missing' };

/** The phone's own file wins; otherwise the cloud copy, if there is one. */
export function mediaAvailability(
  row: { remotePath: string | null; bytes: number },
  resolvedLocalUri: string | null,
): MediaAvailability {
  if (resolvedLocalUri) return { kind: 'local', uri: resolvedLocalUri };
  if (row.remotePath) return { kind: 'cloud', remotePath: row.remotePath, bytes: row.bytes };
  return { kind: 'missing' };
}

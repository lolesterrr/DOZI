// Sync (task 3.3, ARCHITECTURE §4). Pure rules only: how a phone row becomes a server row and
// back, which side wins, where the next pull starts, how long to wait after an error. The
// database work is in `repo.ts`, the network in `engine.ts`.

/** How a column is stored on the server (supabase/migrations) compared with SQLite. */
export type ColumnKind = 'text' | 'number' | 'bool' | 'json' | 'timestamp' | 'date';

export type SyncColumn = {
  /** The Drizzle property name, e.g. `updatedAt`. */
  prop: string;
  /** The column name on both sides, e.g. `updated_at`. */
  remote: string;
  kind: ColumnKind;
};

export type SyncTableSpec = {
  name: string;
  /** Primary-key column names (remote names). */
  key: readonly string[];
  columns: readonly SyncColumn[];
};

export type LocalRow = Record<string, unknown>;
export type RemoteRow = Record<string, unknown>;

/** Columns that are instants (`timestamptz` on the server). The rest of the dates are days. */
export const TIMESTAMP_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'due',
  'last_review',
  'reviewed_at',
  'started_at',
  'finished_at',
  'unlocked_at',
]);

/** `YYYY-MM-DD` columns (`date` on the server). */
export const DATE_COLUMNS = new Set([
  'study_day',
  'buried_until',
  'last_counted_day',
  'repair_available_until',
  'last_repair_day',
  'exam_date',
]);

/** Local-only columns that never go to the server (ARCHITECTURE decisions 2026-11-03). */
export const LOCAL_ONLY_COLUMNS = new Set(['_dirty', '_synced_at', 'local_uri', 'upload_status']);

/** Works out a column's kind from its name and its SQLite type. */
export function columnKind(remote: string, sqliteType: string): ColumnKind {
  if (remote.endsWith('_json')) return 'json';
  if (TIMESTAMP_COLUMNS.has(remote)) return 'timestamp';
  if (DATE_COLUMNS.has(remote)) return 'date';
  if (sqliteType === 'SQLiteBoolean') return 'bool';
  if (sqliteType === 'SQLiteInteger' || sqliteType === 'SQLiteReal') return 'number';
  return 'text';
}

/**
 * The server sends `2026-11-05T10:00:00.123456+00:00`; the phone stores
 * `2026-11-05T10:00:00.123Z` (ARCHITECTURE §3.1). Anything unreadable is kept as it came.
 */
export function normaliseTimestamp(value: string): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

/** One phone row as the server wants it. JSON text becomes JSON; booleans stay booleans. */
export function toRemote(spec: SyncTableSpec, row: LocalRow): RemoteRow {
  const out: RemoteRow = {};
  for (const column of spec.columns) {
    const value = row[column.prop];
    if (value === undefined) continue;
    if (value === null) {
      out[column.remote] = null;
    } else if (column.kind === 'json') {
      try {
        out[column.remote] = JSON.parse(String(value));
      } catch {
        out[column.remote] = String(value);
      }
    } else if (column.kind === 'bool') {
      out[column.remote] = Boolean(value);
    } else {
      out[column.remote] = value;
    }
  }
  return out;
}

/** One server row as the phone stores it (only the synced columns). */
export function fromRemote(spec: SyncTableSpec, row: RemoteRow): LocalRow {
  const out: LocalRow = {};
  for (const column of spec.columns) {
    if (!(column.remote in row)) continue;
    const value = row[column.remote];
    if (value === null || value === undefined) {
      out[column.prop] = null;
    } else if (column.kind === 'json') {
      out[column.prop] = typeof value === 'string' ? value : JSON.stringify(value);
    } else if (column.kind === 'timestamp') {
      out[column.prop] = normaliseTimestamp(String(value));
    } else if (column.kind === 'date') {
      out[column.prop] = String(value).slice(0, 10);
    } else if (column.kind === 'bool') {
      out[column.prop] = value === true || value === 1 || value === 'true';
    } else if (column.kind === 'number') {
      out[column.prop] = typeof value === 'number' ? value : Number(value);
    } else {
      out[column.prop] = String(value);
    }
  }
  return out;
}

/** A row's primary key as one string, e.g. `note|n1|t1` for item_tags. */
export function rowKey(spec: SyncTableSpec, row: RemoteRow): string {
  return spec.key.map((k) => String(row[k] ?? '')).join('|');
}

/**
 * ARCHITECTURE §4 pull rule: a row from the server replaces the phone's copy, unless the phone's
 * copy has changes the server hasn't seen yet and is at least as new (that copy is pushed next).
 */
export function shouldTakeRemote(
  local: { updatedAt: string; dirty: boolean } | undefined,
  remoteUpdatedAt: string,
): boolean {
  if (!local) return true;
  if (!local.dirty) return true;
  return Date.parse(remoteUpdatedAt) > Date.parse(local.updatedAt);
}

/**
 * Re-read this much before the last cursor on every pull: a slow transaction on the server can
 * commit rows with an earlier `server_updated_at` after a pull has passed them (ARCHITECTURE
 * decisions, "Sync trigger rules"). Pulling a row twice is harmless.
 */
export const PULL_OVERLAP_MS = 2 * 60 * 1000;

/** Where a table's pull starts: null for everything, else a little before the cursor. */
export function pullSince(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  const ms = Date.parse(cursor);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - PULL_OVERLAP_MS).toISOString();
}

/** The newest `server_updated_at` in a page, kept as the server wrote it (microseconds). */
export function newestCursor(
  current: string | null | undefined,
  rows: readonly RemoteRow[],
): string | null {
  let best = current ?? null;
  for (const row of rows) {
    const value = row.server_updated_at;
    if (typeof value !== 'string') continue;
    if (best === null || compareServerTimes(value, best) > 0) best = value;
  }
  return best;
}

/**
 * Compares two server timestamps. Date.parse drops microseconds, so equal milliseconds fall back
 * to comparing the fraction digits.
 */
export function compareServerTimes(a: string, b: string): number {
  const diff = Date.parse(a) - Date.parse(b);
  if (diff !== 0 && !Number.isNaN(diff)) return diff;
  const fraction = (s: string) => (/\.(\d+)/.exec(s)?.[1] ?? '').padEnd(6, '0');
  return fraction(a).localeCompare(fraction(b));
}

/** Rows pushed per request and pulled per page (ARCHITECTURE §4). */
export const PUSH_BATCH = 200;
export const PULL_PAGE = 500;

/** Wait before retrying after a failed sync: 5 s, 10 s, 20 s … up to 5 minutes. */
export function backoffDelay(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(5000 * 2 ** (failures - 1), 5 * 60 * 1000);
}

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

/** Is this error just "no internet"? Then the status says offline, not error. */
export function isOfflineError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? error).toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('internet')
  );
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago" (wording comes from strings). */
export function timeAgo(
  then: string,
  now: number,
  words: {
    justNow: string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    daysAgo: (n: number) => string;
  },
): string {
  const minutes = Math.floor((now - Date.parse(then)) / 60000);
  if (!(minutes >= 1)) return words.justNow;
  if (minutes < 60) return words.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return words.hoursAgo(hours);
  return words.daysAgo(Math.floor(hours / 24));
}

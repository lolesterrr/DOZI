import { and, asc, eq, type SQL } from 'drizzle-orm';

import { achievements, profiles, type Profile } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getSetting, setSetting } from '@/features/settings/repo';

import { fromRemote, shouldTakeRemote, type LocalRow, type RemoteRow } from './logic';
import type { SyncTable } from './tables';

// The database side of sync (task 3.3): which rows to upload, marking them uploaded, and
// applying rows from the server with the ARCHITECTURE §4 merge rule.

function propOf(t: SyncTable, remote: string): string {
  const column = t.columns.find((c) => c.remote === remote);
  if (!column) throw new Error(`${t.name} has no synced column ${remote}`);
  return column.prop;
}

/** WHERE primary key = the row's key. `row` uses Drizzle property names. */
function keyWhere(t: SyncTable, row: LocalRow): SQL {
  const parts = t.key.map((k) => eq(t.byRemote[k], row[propOf(t, k)] as string));
  return (parts.length === 1 ? parts[0] : and(...parts)) as SQL;
}

/** Up to `limit` of the student's rows with changes the server hasn't seen. */
export async function selectDirty(
  db: AppDatabase,
  t: SyncTable,
  ownerId: string,
  limit: number,
): Promise<LocalRow[]> {
  return (await db
    .select()
    .from(t.table)
    .where(and(eq(t.byRemote.owner_id, ownerId), eq(t.dirty, true)))
    .orderBy(asc(t.byRemote.updated_at))
    .limit(limit)) as LocalRow[];
}

/**
 * Marks pushed rows as uploaded. A row edited again while the upload was on its way has a newer
 * `updated_at`, so it stays dirty and goes up next time.
 */
export async function markPushed(
  db: AppDatabase,
  t: SyncTable,
  rows: readonly LocalRow[],
  syncedAt: string,
): Promise<number> {
  let cleaned = 0;
  db.transaction((tx) => {
    for (const row of rows) {
      const result = tx
        .update(t.table)
        .set({ dirty: false, syncedAt } as never)
        .where(and(keyWhere(t, row), eq(t.byRemote.updated_at, row.updatedAt as string)))
        .run() as { changes?: number };
      cleaned += result.changes ?? 0;
    }
  });
  return cleaned;
}

/**
 * Applies rows from the server. Each replaces the phone's copy unless that copy has unsent
 * changes and is at least as new (`shouldTakeRemote`). Applied rows are not dirty. Returns how
 * many rows changed on the phone.
 */
export async function applyPulled(
  db: AppDatabase,
  t: SyncTable,
  remoteRows: readonly RemoteRow[],
  syncedAt: string,
): Promise<number> {
  let applied = 0;
  const dirty = t.dirty;
  const keyColumns = t.key.map((k) => t.byRemote[k]);
  db.transaction((tx) => {
    for (const remote of remoteRows) {
      const local = fromRemote(t, remote);
      const [existing] = tx
        .select({ updatedAt: t.byRemote.updated_at, dirty })
        .from(t.table)
        .where(keyWhere(t, local))
        .limit(1)
        .all() as { updatedAt: string; dirty: boolean }[];
      if (!shouldTakeRemote(existing, local.updatedAt as string)) continue;

      // Badges are unique per student on the phone. Two phones may each have unlocked the same
      // badge offline (different ids): keep the one already here.
      if (!existing && t.name === 'achievements') {
        const [sameBadge] = tx
          .select({ id: achievements.id })
          .from(achievements)
          .where(
            and(
              eq(achievements.ownerId, local.ownerId as string),
              eq(achievements.key, local.key as string),
            ),
          )
          .limit(1)
          .all();
        if (sameBadge) continue;
      }

      const values = { ...local, dirty: false, syncedAt };
      const update: LocalRow = { ...values };
      for (const k of t.key) delete update[propOf(t, k)];
      tx.insert(t.table)
        .values(values as never)
        .onConflictDoUpdate({ target: keyColumns as never, set: update as never })
        .run();
      applied++;
    }
  });
  return applied;
}

// ---------------------------------------------------------------------------------------------
// Cursors and bookkeeping (local settings)
// ---------------------------------------------------------------------------------------------
const cursorKey = (table: string) => `sync.cursor.${table}`;

export async function getCursor(db: AppDatabase, table: string): Promise<string | null> {
  const value = await getSetting(db, cursorKey(table));
  return typeof value === 'string' ? value : null;
}

export async function setCursor(db: AppDatabase, table: string, cursor: string): Promise<void> {
  await setSetting(db, cursorKey(table), cursor);
}

export async function getLastSyncedAt(db: AppDatabase): Promise<string | null> {
  const value = await getSetting(db, 'sync.lastSyncedAt');
  return typeof value === 'string' ? value : null;
}

export async function setLastSyncedAt(db: AppDatabase, at: string): Promise<void> {
  await setSetting(db, 'sync.lastSyncedAt', at);
}

// ---------------------------------------------------------------------------------------------
// The profile (one row, keyed by the auth user id; no _dirty column on the phone)
// ---------------------------------------------------------------------------------------------
/** The profile fields the server keeps (supabase/migrations: public.profiles). */
export function profileToRemote(profile: Profile): RemoteRow {
  return {
    id: profile.id,
    display_name: profile.displayName,
    year_of_study: profile.yearOfStudy,
    semester: profile.semester,
    cohort_code: profile.cohortCode,
    timezone: profile.timezone,
    daily_goal_xp: profile.dailyGoalXp,
    reminder_time: profile.reminderTime,
    exam_date: profile.examDate,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

/** The `updated_at` of the profile as last pushed, so it's only sent again after a change. */
export async function getProfilePushedAt(db: AppDatabase): Promise<string | null> {
  const value = await getSetting(db, 'sync.profilePushedAt');
  return typeof value === 'string' ? value : null;
}

export async function setProfilePushedAt(db: AppDatabase, at: string): Promise<void> {
  await setSetting(db, 'sync.profilePushedAt', at);
}

/** Takes the server's profile when it is newer (e.g. the goal was changed on another phone). */
export async function applyRemoteProfile(
  db: AppDatabase,
  profile: Profile,
  remote: RemoteRow,
): Promise<boolean> {
  const remoteUpdated = Date.parse(String(remote.updated_at));
  if (!(remoteUpdated > Date.parse(profile.updatedAt))) {
    // Still take a role change (only the server can set it).
    if (typeof remote.role === 'string' && remote.role !== profile.role) {
      await db
        .update(profiles)
        .set({ role: remote.role as Profile['role'] })
        .where(eq(profiles.id, profile.id));
      return true;
    }
    return false;
  }
  const updatedAt = new Date(remoteUpdated).toISOString();
  await db
    .update(profiles)
    .set({
      displayName: (remote.display_name as string | null) ?? null,
      yearOfStudy: (remote.year_of_study as number | null) ?? null,
      semester: (remote.semester as number | null) ?? null,
      cohortCode: (remote.cohort_code as string | null) ?? null,
      timezone: (remote.timezone as string) ?? profile.timezone,
      dailyGoalXp: (remote.daily_goal_xp as number) ?? profile.dailyGoalXp,
      reminderTime: (remote.reminder_time as string | null) ?? null,
      examDate: remote.exam_date ? String(remote.exam_date).slice(0, 10) : null,
      role: (remote.role as Profile['role']) ?? profile.role,
      updatedAt,
    })
    .where(eq(profiles.id, profile.id));
  // What we now hold matches the server, so there's nothing to push back.
  await setProfilePushedAt(db, updatedAt);
  return true;
}

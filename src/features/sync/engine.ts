import type { SupabaseClient } from '@supabase/supabase-js';

import type { AppDatabase } from '@/db/types';
import { refreshStreak } from '@/features/gamification/repo';
import { getProfile } from '@/features/profile/repo';
import { rebuildAfterSync } from '@/features/srs/repo';
import { nowIso } from '@/lib/time';

import {
  compareServerTimes,
  newestCursor,
  pullSince,
  PULL_PAGE,
  PUSH_BATCH,
  toRemote,
  type LocalRow,
  type RemoteRow,
} from './logic';
import {
  applyPulled,
  applyRemoteProfile,
  getCursor,
  getProfilePushedAt,
  markPushed,
  profileToRemote,
  selectDirty,
  setCursor,
  setLastSyncedAt,
  setProfilePushedAt,
} from './repo';
import { SYNC_TABLES, type SyncTable } from './tables';

// One sync run (task 3.3, ARCHITECTURE §4): push every dirty row in batches, then pull what
// changed on the server since each table's cursor, then rebuild what is worked out from the
// pulled rows: card schedules from review logs and the streak from XP (task 3.4). The network sits behind `SyncTransport`, so
// tests can run two phones against a fake server.

export type PullRequest = {
  table: string;
  ownerColumn: string;
  ownerId: string;
  /** Rows with server_updated_at at or after this; null for everything. */
  since: string | null;
  limit: number;
  key: readonly string[];
};

export interface SyncTransport {
  upsert(table: string, rows: RemoteRow[], conflictKey: readonly string[]): Promise<void>;
  pull(request: PullRequest): Promise<RemoteRow[]>;
  getProfile(id: string): Promise<RemoteRow | null>;
  upsertProfile(row: RemoteRow): Promise<void>;
}

export type SyncSummary = { pushed: number; pulled: number };

/** Pulled rows by table name (only tables where something changed on the phone). */
type Pulled = Map<string, LocalRow[]>;

type Deps = { now?: () => string; tables?: readonly SyncTable[] };

async function pushTable(
  db: AppDatabase,
  transport: SyncTransport,
  t: SyncTable,
  ownerId: string,
  now: () => string,
): Promise<number> {
  let pushed = 0;
  // Each round sends up to 200 rows. Rows edited during a round stay dirty; stop when a round
  // cleans nothing so a row edited over and over can't keep us here.
  for (;;) {
    const rows = await selectDirty(db, t, ownerId, PUSH_BATCH);
    if (rows.length === 0) break;
    await transport.upsert(
      t.name,
      rows.map((row) => toRemote(t, row)),
      t.key,
    );
    const cleaned = await markPushed(db, t, rows, now());
    pushed += rows.length;
    if (rows.length < PUSH_BATCH || cleaned === 0) break;
  }
  return pushed;
}

async function pullTable(
  db: AppDatabase,
  transport: SyncTransport,
  t: SyncTable,
  ownerId: string,
  now: () => string,
  into: Pulled,
): Promise<number> {
  let pulled = 0;
  let cursor = await getCursor(db, t.name);
  let since = pullSince(cursor);
  for (;;) {
    const rows = await transport.pull({
      table: t.name,
      ownerColumn: 'owner_id',
      ownerId,
      since,
      limit: PULL_PAGE,
      key: t.key,
    });
    if (rows.length === 0) break;
    const applied = await applyPulled(db, t, rows, now());
    if (applied.length > 0) into.set(t.name, [...(into.get(t.name) ?? []), ...applied]);
    pulled += applied.length;
    const next = newestCursor(cursor, rows);
    if (next) {
      cursor = next;
      await setCursor(db, t.name, next);
    }
    if (rows.length < PULL_PAGE) break;
    // A full page: carry on from its newest row. If a whole page shared one timestamp we'd ask
    // for the same page again, so stop (practically impossible: the server uses microseconds).
    if (since && next && compareServerTimes(next, since) <= 0) break;
    since = next;
  }
  return pulled;
}

/**
 * Task 3.4: answers from another phone change a card's schedule, so replay FSRS for every card
 * whose logs or state just arrived; XP from another phone changes the streak, so work it out
 * again. Both only write (and so only push next time) when the result differs.
 */
async function rebuildDerived(
  db: AppDatabase,
  ownerId: string,
  pulled: Pulled,
  now: () => string,
): Promise<void> {
  const instanceIds = [
    ...(pulled.get('review_logs') ?? []),
    ...(pulled.get('card_state') ?? []),
  ].map((row) => String(row.cardInstanceId));
  if (instanceIds.length > 0) await rebuildAfterSync(db, instanceIds, { now });
  if (pulled.has('xp_events') || pulled.has('streak_state')) {
    await refreshStreak(db, ownerId, { now });
  }
}

async function syncProfile(db: AppDatabase, transport: SyncTransport): Promise<void> {
  const profile = await getProfile(db);
  if (!profile) return;
  const pushedAt = await getProfilePushedAt(db);
  if (pushedAt !== profile.updatedAt) {
    await transport.upsertProfile(profileToRemote(profile));
    await setProfilePushedAt(db, profile.updatedAt);
  }
  const remote = await transport.getProfile(profile.id);
  if (remote) await applyRemoteProfile(db, profile, remote);
}

/**
 * Runs one full sync for the signed-in student whose id is `ownerId` (the profile id after
 * adoption, task 3.2). Throws on a network or server error; the caller retries with backoff.
 */
export async function runSync(
  db: AppDatabase,
  transport: SyncTransport,
  ownerId: string,
  { now = nowIso, tables = SYNC_TABLES }: Deps = {},
): Promise<SyncSummary> {
  await syncProfile(db, transport);
  let pushed = 0;
  for (const t of tables) pushed += await pushTable(db, transport, t, ownerId, now);
  let pulled = 0;
  const applied: Pulled = new Map();
  for (const t of tables) pulled += await pullTable(db, transport, t, ownerId, now, applied);
  await rebuildDerived(db, ownerId, applied, now);
  await setLastSyncedAt(db, now());
  return { pushed, pulled };
}

/** The real transport: Supabase's REST API, as the signed-in student (RLS applies). */
export function supabaseTransport(client: SupabaseClient): SyncTransport {
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  return {
    async upsert(table, rows, conflictKey) {
      const { error } = await client
        .from(table)
        .upsert(rows, { onConflict: conflictKey.join(','), defaultToNull: false });
      check(error);
    },
    async pull({ table, ownerColumn, ownerId, since, limit, key }) {
      let query = client.from(table).select('*').eq(ownerColumn, ownerId);
      if (since) query = query.gte('server_updated_at', since);
      query = query.order('server_updated_at', { ascending: true });
      for (const k of key) query = query.order(k, { ascending: true });
      const { data, error } = await query.limit(limit);
      check(error);
      return (data ?? []) as RemoteRow[];
    },
    async getProfile(id) {
      const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();
      check(error);
      return (data as RemoteRow | null) ?? null;
    },
    async upsertProfile(row) {
      const { error } = await client.from('profiles').upsert(row, { onConflict: 'id' });
      check(error);
    },
  };
}

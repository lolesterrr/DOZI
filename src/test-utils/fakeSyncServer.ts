import type { PullRequest, SyncTransport } from '@/features/sync/engine';
import type { RemoteRow } from '@/features/sync/logic';

/**
 * An in-memory stand-in for the Supabase tables (supabase/migrations): last write wins on
 * updated_at, the server stamps server_updated_at (with microseconds), and timestamps come back
 * in Postgres' "+00:00" style.
 */
export function createFakeServer() {
  const tables = new Map<string, Map<string, RemoteRow>>();
  const profiles = new Map<string, RemoteRow>();
  let clock = Date.parse('2026-11-05T12:00:00.000Z');
  let micro = 0;
  let failNext: Error | null = null;
  const calls = { upserts: 0, pulls: 0 };

  const stamp = () => {
    clock += 1;
    micro = (micro + 7) % 1000;
    return new Date(clock).toISOString().replace('Z', `${String(micro).padStart(3, '0')}+00:00`);
  };
  const pg = (value: unknown) =>
    typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)
      ? new Date(Date.parse(value)).toISOString().replace('Z', '+00:00')
      : value;
  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) tables.set(name, (t = new Map()));
    return t;
  };
  const write = (store: Map<string, RemoteRow>, key: string, row: RemoteRow) => {
    const existing = store.get(key);
    if (existing && Date.parse(String(row.updated_at)) < Date.parse(String(existing.updated_at)))
      return; // stale write: ignored
    const stored: RemoteRow = { ...existing };
    for (const [k, v] of Object.entries(row)) stored[k] = pg(v);
    stored.server_updated_at = stamp();
    store.set(key, stored);
  };

  const transport: SyncTransport = {
    async upsert(name, rows, conflictKey) {
      calls.upserts++;
      if (failNext) {
        const error = failNext;
        failNext = null;
        throw error;
      }
      for (const row of rows) write(table(name), conflictKey.map((k) => row[k]).join('|'), row);
    },
    async pull({ table: name, ownerColumn, ownerId, since, limit }: PullRequest) {
      calls.pulls++;
      return [...table(name).values()]
        .filter((r) => r[ownerColumn] === ownerId)
        .filter((r) => !since || Date.parse(String(r.server_updated_at)) >= Date.parse(since))
        .sort((a, b) => String(a.server_updated_at).localeCompare(String(b.server_updated_at)))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },
    async getProfile(id) {
      const row = profiles.get(id);
      return row ? { role: 'student', ...structuredClone(row) } : null;
    },
    async upsertProfile(row) {
      write(profiles, String(row.id), row);
    },
  };

  return {
    transport,
    calls,
    rows: (name: string) => [...table(name).values()],
    profile: (id: string) => profiles.get(id),
    failNextUpsert: (error: Error) => {
      failNext = error;
    },
  };
}

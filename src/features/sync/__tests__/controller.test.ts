import { ensureProfile } from '@/features/profile/repo';
import { createTestDatabase } from '@/test-utils/db';
import { createFakeServer } from '@/test-utils/fakeSyncServer';
import { notes } from '@/db/schema';

import {
  configureSync,
  getSyncStatus,
  requestSync,
  requestSyncAfterSession,
  resetSyncForTests,
} from '../controller';
import { timeAgo } from '../logic';

const USER = 'user-a';

async function setup() {
  const db = createTestDatabase();
  await ensureProfile(db, { newId: () => USER });
  const server = createFakeServer();
  return { db, server };
}

// Lets the sync run's promises settle between fake-timer steps.
const flush = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  resetSyncForTests();
});
afterEach(() => {
  resetSyncForTests();
  jest.useRealTimers();
});

describe('sync controller', () => {
  it('syncs straight away when a student is signed in', async () => {
    const { db, server } = await setup();
    configureSync({ db, transport: server.transport, ownerId: USER });
    await jest.advanceTimersByTimeAsync(0);
    await flush();
    expect(getSyncStatus()).toMatchObject({ phase: 'idle' });
    expect(getSyncStatus().lastSyncedAt).not.toBeNull();
    expect(server.calls.pulls).toBeGreaterThan(0);
  });

  it('shows offline and tries again later', async () => {
    const { db, server } = await setup();
    const at = new Date().toISOString();
    db.insert(notes)
      .values({ id: 'n1', ownerId: USER, createdAt: at, updatedAt: at, contentJson: '{}' })
      .run();
    server.failNextUpsert(new TypeError('Network request failed'));
    configureSync({ db, transport: server.transport, ownerId: USER });
    await jest.advanceTimersByTimeAsync(0);
    await flush();
    expect(getSyncStatus().phase).toBe('offline');

    await jest.advanceTimersByTimeAsync(5000);
    await flush();
    expect(getSyncStatus().phase).toBe('idle');
    expect(server.rows('notes')).toHaveLength(1);
  });

  it('waits 10 seconds after a session, and does nothing when signed out', async () => {
    const { db, server } = await setup();
    requestSync();
    await jest.advanceTimersByTimeAsync(1000);
    expect(server.calls.pulls).toBe(0);

    configureSync({ db, transport: server.transport, ownerId: USER });
    await jest.advanceTimersByTimeAsync(0);
    await flush();
    const before = server.calls.pulls;
    requestSyncAfterSession();
    await jest.advanceTimersByTimeAsync(9000);
    await flush();
    expect(server.calls.pulls).toBe(before);
    await jest.advanceTimersByTimeAsync(1000);
    await flush();
    expect(server.calls.pulls).toBeGreaterThan(before);
  });
});

describe('timeAgo', () => {
  const words = {
    justNow: 'just now',
    minutesAgo: (n: number) => `${n}m`,
    hoursAgo: (n: number) => `${n}h`,
    daysAgo: (n: number) => `${n}d`,
  };
  const now = Date.parse('2026-11-05T12:00:00Z');
  it('says how long ago', () => {
    expect(timeAgo('2026-11-05T11:59:30Z', now, words)).toBe('just now');
    expect(timeAgo('2026-11-05T11:55:00Z', now, words)).toBe('5m');
    expect(timeAgo('2026-11-05T09:00:00Z', now, words)).toBe('3h');
    expect(timeAgo('2026-11-03T12:00:00Z', now, words)).toBe('2d');
  });
});

import type { AppDatabase } from '@/db/types';

import { createTestDatabase } from './db';

// Makes Drizzle's `useLiveQuery` work in Jest against an in-memory database. In the app,
// expo-sqlite tells live queries when a table changes; here the test database reports its own
// writes. Use with:
//   jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);

type Listener = (event: { tableName: string }) => void;

const listeners = new Set<Listener>();

export const expoSqliteMock = {
  addDatabaseChangeListener(listener: Listener) {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  },
};

/** A test database whose writes re-run the live queries that read the written table. */
export function createLiveTestDatabase(): AppDatabase {
  return createTestDatabase({
    // Just after the write has run (the logger sees the query before it runs), so the re-run
    // happens inside the act() of whatever test step made the write.
    onWrite: (tableName) =>
      queueMicrotask(() => {
        for (const listener of [...listeners]) listener({ tableName });
      }),
  });
}

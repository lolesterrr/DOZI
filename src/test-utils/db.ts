import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import * as schema from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/**
 * A fresh in-memory SQLite database with every app migration applied. Repo tests use this in
 * place of expo-sqlite, which only runs on a device. With `onWrite`, each insert, update or
 * delete reports its table (see `liveQueries.ts`, which makes Drizzle's live queries re-run).
 */
export function createTestDatabase({
  onWrite,
}: { onWrite?: (tableName: string) => void } = {}): AppDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const logger = onWrite
    ? {
        logQuery(query: string) {
          const match = /^\s*(?:insert into|update|delete from)\s+"(\w+)"/i.exec(query);
          if (match) onWrite(match[1]);
        },
      }
    : undefined;
  const db = drizzle(sqlite, { schema, logger });
  migrate(db, { migrationsFolder: path.join(__dirname, '../db/migrations') });
  return db;
}

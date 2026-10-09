import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import * as schema from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/**
 * A fresh in-memory SQLite database with every app migration applied. Repo tests use this in
 * place of expo-sqlite, which only runs on a device.
 */
export function createTestDatabase(): AppDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../db/migrations') });
  return db;
}

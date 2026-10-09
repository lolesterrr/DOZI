import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';

import migrations from './migrations/migrations';
import * as schema from './schema';

export const DATABASE_NAME = 'dozi.db';

export type ExpoAppDatabase = ExpoSQLiteDatabase<typeof schema>;

/** Opens (or creates) the app's SQLite file on the device. */
export function openAppDatabase(): ExpoAppDatabase {
  // The change listener lets Drizzle's useLiveQuery re-run when a table changes.
  const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return drizzle(sqlite, { schema });
}

/** Applies any migrations the database hasn't run yet. Safe to call on every start. */
export function migrateAppDatabase(db: ExpoAppDatabase): Promise<void> {
  return migrate(db, migrations);
}

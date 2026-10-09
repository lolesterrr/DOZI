import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * The Drizzle database every repo function takes. In the app it is expo-sqlite; in Jest it is an
 * in-memory better-sqlite3 database. Both are synchronous SQLite drivers with the same API.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

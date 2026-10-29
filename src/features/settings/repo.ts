import { eq } from 'drizzle-orm';

import { settings } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import {
  APP_SETTINGS_KEY,
  mergeAppSettings,
  parseAppSettings,
  type AppSettings,
  type AppSettingsChanges,
} from './logic';

/**
 * Local-only key/value settings. Values are stored as JSON, so any JSON-friendly value works.
 * The value comes back as `unknown`: callers check its shape (with zod, once forms arrive).
 */
export async function getSetting(db: AppDatabase, key: string): Promise<unknown> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  try {
    return JSON.parse(row.valueJson);
  } catch {
    // A corrupt value behaves as if the setting was never saved.
    return undefined;
  }
}

/** Saves a setting, replacing any earlier value. */
export async function setSetting(db: AppDatabase, key: string, value: unknown): Promise<void> {
  const valueJson = JSON.stringify(value);
  if (valueJson === undefined) throw new Error(`Setting "${key}" can’t be saved as JSON`);
  await db
    .insert(settings)
    .values({ key, valueJson })
    .onConflictDoUpdate({ target: settings.key, set: { valueJson } });
}

export async function deleteSetting(db: AppDatabase, key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}

/** The app settings (theme, text size, notification toggles, data saver), with defaults. */
export async function getAppSettings(db: AppDatabase): Promise<AppSettings> {
  return parseAppSettings(await getSetting(db, APP_SETTINGS_KEY));
}

/** Changes some app settings and keeps the rest. Returns the new settings. */
export async function updateAppSettings(
  db: AppDatabase,
  changes: AppSettingsChanges,
): Promise<AppSettings> {
  const next = mergeAppSettings(await getAppSettings(db), changes);
  await setSetting(db, APP_SETTINGS_KEY, next);
  return next;
}

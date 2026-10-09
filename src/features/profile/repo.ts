import { asc, eq } from 'drizzle-orm';

import { profiles, type NewProfile, type Profile } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';

type Deps = { newId?: () => string; now?: () => string };

const isoNow = () => new Date().toISOString();

/** The device's profile, or undefined before the first launch has created it. */
export async function getProfile(db: AppDatabase): Promise<Profile | undefined> {
  const rows = await db.select().from(profiles).orderBy(asc(profiles.createdAt)).limit(1);
  return rows[0];
}

/**
 * Returns the device's profile, creating it with a fresh UUID on first launch.
 * Runs on every app start; after the first launch it only reads.
 */
export async function ensureProfile(
  db: AppDatabase,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Profile> {
  const existing = await getProfile(db);
  if (existing) return existing;

  const timestamp = now();
  const [created] = await db
    .insert(profiles)
    .values({ id: newId(), createdAt: timestamp, updatedAt: timestamp })
    .returning();
  return created;
}

export type ProfileChanges = Partial<Omit<NewProfile, 'id' | 'createdAt' | 'updatedAt'>>;

/** Saves changes to the profile and bumps `updated_at`. */
export async function updateProfile(
  db: AppDatabase,
  id: string,
  changes: ProfileChanges,
  { now = isoNow }: Pick<Deps, 'now'> = {},
): Promise<Profile | undefined> {
  const [updated] = await db
    .update(profiles)
    .set({ ...changes, updatedAt: now() })
    .where(eq(profiles.id, id))
    .returning();
  return updated;
}

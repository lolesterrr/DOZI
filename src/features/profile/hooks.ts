import { asc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { useDatabase } from '@/db/DatabaseProvider';
import { profiles } from '@/db/schema';

/** The device's profile, kept up to date as it changes. */
export function useProfile() {
  const db = useDatabase();
  const { data, error } = useLiveQuery(
    db.select().from(profiles).orderBy(asc(profiles.createdAt)).limit(1),
  );
  return { profile: data[0], error };
}

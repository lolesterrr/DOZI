import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { settings } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';
import { updateProfile } from '@/features/profile/repo';
import { createLogger } from '@/lib/logger';

import {
  APP_SETTINGS_KEY,
  parseAppSettings,
  type AppSettings,
  type AppSettingsChanges,
} from './logic';
import { updateAppSettings } from './repo';

const log = createLogger('settings');

/** The app settings, kept up to date as they change, and a function to change them. */
export function useAppSettings(): {
  loading: boolean;
  settings: AppSettings;
  update: (changes: AppSettingsChanges) => Promise<void>;
} {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(settings).where(eq(settings.key, APP_SETTINGS_KEY)).limit(1),
  );
  const value = data[0]?.valueJson;
  const parsed = useMemo(() => {
    try {
      return parseAppSettings(value === undefined ? undefined : JSON.parse(value));
    } catch {
      return parseAppSettings(undefined);
    }
  }, [value]);
  const update = useCallback(
    async (changes: AppSettingsChanges) => {
      try {
        await updateAppSettings(db, changes);
      } catch (error) {
        log.warn('Could not save a setting', { error: String(error) });
        throw error;
      }
    },
    [db],
  );
  return { loading: updatedAt === undefined, settings: parsed, update };
}

/** Changes to the profile that the Settings screen makes. */
export function useProfileSettings() {
  const db = useDatabase();
  const profileId = useProfile().profile?.id;
  const setDailyGoal = useCallback(
    async (xp: number) => {
      if (profileId) await updateProfile(db, profileId, { dailyGoalXp: xp });
    },
    [db, profileId],
  );
  const setReminderTime = useCallback(
    async (time: string | null) => {
      if (profileId) await updateProfile(db, profileId, { reminderTime: time });
    },
    [db, profileId],
  );
  return { setDailyGoal, setReminderTime };
}

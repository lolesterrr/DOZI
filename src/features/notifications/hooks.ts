import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useXpOverview, useStreak } from '@/features/gamification/hooks';
import { useProfile } from '@/features/profile/hooks';
import { useAppSettings } from '@/features/settings/hooks';
import { useActiveTimetable } from '@/features/timetable/hooks';
import { planLectureReminders } from '@/features/timetable/logic';
import { createLogger } from '@/lib/logger';
import { DEFAULT_TIMEZONE, nowIso } from '@/lib/time';

import { planNotifications, type WeeklyNotification } from './logic';
import {
  applyPlan,
  getPermissionState,
  requestPermission,
  type PermissionState,
} from './scheduler';

const log = createLogger('notifications');

/**
 * Keeps the phone's scheduled notifications in step with the settings and today's progress
 * (task 2.9). Mount it once, high up. It plans again when a setting, the profile, today's XP or
 * the streak changes, and when the app returns to the foreground (a new day may have begun).
 * The timetable's lecture reminders (weekly, repeating) are scheduled alongside and re-planned
 * whenever a class changes. Nothing is scheduled until the student has allowed notifications.
 */
export function useNotificationSync() {
  const { profile } = useProfile();
  const { loading: settingsLoading, settings } = useAppSettings();
  const { goal } = useXpOverview();
  const { streak } = useStreak();
  const { classes } = useActiveTimetable();
  const [foreground, setForeground] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForeground((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  const profileId = profile?.id;
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const reminderTime = profile?.reminderTime ?? null;
  const examDate = profile?.examDate ?? null;
  const { daily, streak: streakOn, exam, lectures } = settings.notifications;
  // The lecture reminders as a string, so the effect below re-plans only when they change, not
  // on every live-query tick.
  const weeklyJson = useMemo(
    () => JSON.stringify(lectures ? planLectureReminders(classes) : []),
    [lectures, classes],
  );
  const goalMet = goal.met;
  const todayCounted = streak.todayCounted;
  const streakDays = streak.current;

  useEffect(() => {
    if (!profileId || settingsLoading) return;
    let active = true;
    (async () => {
      const permission = await getPermissionState();
      if (!active) return;
      const plan =
        permission === 'granted'
          ? planNotifications({
              now: nowIso(),
              timeZone,
              toggles: { daily, streak: streakOn, exam, lectures },
              reminderTime,
              examDate,
              goalMet,
              todayCounted,
              streakDays,
            })
          : [];
      const weekly =
        permission === 'granted' ? (JSON.parse(weeklyJson) as WeeklyNotification[]) : [];
      await applyPlan(plan, weekly);
    })().catch((error: unknown) =>
      log.warn('Could not update notifications', { error: String(error) }),
    );
    return () => {
      active = false;
    };
  }, [
    profileId,
    settingsLoading,
    timeZone,
    reminderTime,
    examDate,
    daily,
    streakOn,
    exam,
    lectures,
    weeklyJson,
    goalMet,
    todayCounted,
    streakDays,
    foreground,
  ]);
}

/** The notification permission, and a way to ask for it. */
export function useNotificationPermission(): {
  state: PermissionState | null;
  ask: () => Promise<PermissionState>;
} {
  const [state, setState] = useState<PermissionState | null>(null);
  useEffect(() => {
    let active = true;
    getPermissionState()
      .then((s) => active && setState(s))
      .catch(() => active && setState('undetermined'));
    return () => {
      active = false;
    };
  }, []);
  const ask = useCallback(async () => {
    const next = await requestPermission();
    setState(next);
    return next;
  }, []);
  return { state, ask };
}

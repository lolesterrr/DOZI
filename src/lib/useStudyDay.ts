import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { currentStudyDay, DEFAULT_TIMEZONE, systemClock, type Clock, type DayString } from './time';

/** How often an open screen checks whether the study day has rolled over. */
export const STUDY_DAY_CHECK_MS = 60_000;

/**
 * Today's study day, kept up to date. Reading `currentStudyDay()` during render only gives the
 * day at the last re-render, so a screen left open (or an app left in the background) past the
 * 03:00 rollover kept showing yesterday. This checks once a minute and whenever the app comes
 * back to the foreground; React skips the re-render when the day hasn't changed.
 */
export function useStudyDay(
  timeZone: string = DEFAULT_TIMEZONE,
  clock: Clock = systemClock,
): DayString {
  const [day, setDay] = useState(() => currentStudyDay(timeZone, clock));
  useEffect(() => {
    const refresh = () => setDay(currentStudyDay(timeZone, clock));
    refresh();
    const timer = setInterval(refresh, STUDY_DAY_CHECK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [timeZone, clock]);
  return day;
}

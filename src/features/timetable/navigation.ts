import { router } from 'expo-router';

import type { Weekday } from './logic';

export function openTimetable() {
  router.push('/timetable');
}

/** Opens the class editor for an existing class, or for a new one on `weekday`. */
export function openClassEditor(id: string | 'new', weekday?: Weekday) {
  router.push({
    pathname: '/timetable/class/[id]',
    params: weekday ? { id, weekday: String(weekday) } : { id },
  });
}

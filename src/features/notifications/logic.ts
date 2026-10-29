import type { NotificationToggles } from '@/features/settings/logic';
import { strings } from '@/i18n/strings';
import {
  addDays,
  daysBetween,
  localDate,
  localTimeToInstant,
  studyDay,
  type DayString,
} from '@/lib/time';

// Pure planning for local notifications (PRODUCT_SPEC §10, task 2.9). Given the student's
// settings and how today is going, it says which notifications to schedule for the next few
// days. `scheduler.ts` hands the plan to the phone. The rules:
//  - never between 22:00 and 07:00 (quiet hours),
//  - at most 2 a day (exam countdown first, then the daily reminder, then the streak nudge),
//  - the daily reminder only while the goal isn't met, the streak nudge only while today hasn't
//    counted for the streak.
// A notification can't check the goal when it fires, so the plan is made again whenever XP is
// earned or the app opens: the plan for today then drops what no longer applies.

export type NotificationKind = 'exam' | 'daily' | 'streak';

export type PlannedNotification = {
  /** Stable per kind and date, e.g. `daily-2026-10-30`. */
  id: string;
  kind: NotificationKind;
  /** When to show it, ISO-8601 UTC. */
  at: string;
  title: string;
  body: string;
};

export const QUIET_START_MINUTES = 22 * 60;
export const QUIET_END_MINUTES = 7 * 60;
export const MAX_PER_DAY = 2;
export const STREAK_NUDGE_TIME = '20:30';
export const EXAM_TIME = '08:00';
export const EXAM_COUNTDOWN_DAYS = [7, 3, 1] as const;
export const PLAN_DAYS = 7;

const priority: Record<NotificationKind, number> = { exam: 0, daily: 1, streak: 2 };

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** True when `HH:mm` falls in the quiet hours (22:00 up to 07:00). */
export function isQuietTime(time: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return true;
  const m = minutesOf(time);
  return m >= QUIET_START_MINUTES || m < QUIET_END_MINUTES;
}

export type PlannerInput = {
  /** The current instant (ISO). */
  now: string;
  timeZone: string;
  toggles: NotificationToggles;
  /** "HH:mm", or null for no daily reminder. */
  reminderTime: string | null;
  /** `YYYY-MM-DD`, or null. */
  examDate: string | null;
  /** Today (the study day): the daily goal is met. */
  goalMet: boolean;
  /** Today (the study day): it has counted for the streak (10 XP). */
  todayCounted: boolean;
  /** The streak as it stands (days in a row). */
  streakDays: number;
  days?: number;
};

type Candidate = Omit<PlannedNotification, 'id' | 'at'> & { day: DayString; time: string };

/** The notifications to schedule from now, soonest first. */
export function planNotifications(input: PlannerInput): PlannedNotification[] {
  const { now, timeZone, toggles } = input;
  const calendarToday = localDate(now, timeZone);
  const studyToday = studyDay(now, timeZone);
  const nowMs = Date.parse(now);
  const days = input.days ?? PLAN_DAYS;
  const out: PlannedNotification[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(calendarToday, i);
    // Only the study day that is under way has real progress; later days start from nothing.
    const isToday = day === studyToday;
    const candidates: Candidate[] = [];

    if (toggles.exam && input.examDate) {
      const until = daysBetween(day, input.examDate);
      if ((EXAM_COUNTDOWN_DAYS as readonly number[]).includes(until)) {
        candidates.push({
          kind: 'exam',
          day,
          time: EXAM_TIME,
          title: strings.notifications.examTitle(until),
          body: strings.notifications.examBody,
        });
      }
    }

    if (toggles.daily && input.reminderTime && !(isToday && input.goalMet)) {
      const bodies = strings.notifications.dailyBodies;
      candidates.push({
        kind: 'daily',
        day,
        time: input.reminderTime,
        title: strings.notifications.dailyTitle,
        body: bodies[Math.abs(daysBetween('2026-01-01', day)) % bodies.length],
      });
    }

    if (toggles.streak && input.streakDays > 0 && !(isToday && input.todayCounted)) {
      const closeToReminder =
        input.reminderTime !== null &&
        toggles.daily &&
        Math.abs(minutesOf(input.reminderTime) - minutesOf(STREAK_NUDGE_TIME)) < 30;
      if (!closeToReminder) {
        candidates.push({
          kind: 'streak',
          day,
          time: STREAK_NUDGE_TIME,
          title: strings.notifications.streakTitle,
          body: strings.notifications.streakBody(input.streakDays),
        });
      }
    }

    candidates
      .filter((c) => !isQuietTime(c.time))
      .sort((a, b) => priority[a.kind] - priority[b.kind])
      .slice(0, MAX_PER_DAY)
      .forEach(({ day: d, time, ...rest }) => {
        const at = localTimeToInstant(d, time, timeZone);
        // Skip what is already past (and anything a minute away, which may fire before we finish).
        if (Date.parse(at) > nowMs + 60_000) out.push({ id: `${rest.kind}-${d}`, at, ...rest });
      });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

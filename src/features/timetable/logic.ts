import { z } from 'zod';

import { classKinds, type ClassKind, type TimetableClass } from '@/db/schema';
import {
  isQuietTime,
  QUIET_END_MINUTES,
  type WeeklyNotification,
} from '@/features/notifications/logic';
import { strings } from '@/i18n/strings';
import { dayOfWeek, type DayString } from '@/lib/time';
import { courseColourNames, type CourseColour } from '@/theme/tokens';

// Pure timetable logic (PRODUCT_SPEC §13): times, the classes on a day, what's on now and next,
// the week grid layout, and the weekly lecture reminders. No database, no clock: callers pass
// "now" in, so every rule is easy to test.

export { classKinds, type ClassKind };

/** 1 = Monday … 7 = Sunday (ISO weekdays). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const weekdays: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const MINUTES_PER_DAY = 24 * 60;
export const TITLE_MAX = 80;
export const FIELD_MAX = 60;
export const MAX_REMINDERS_PER_CLASS = 3;
/** The phone keeps at most 64 scheduled notifications (iOS); leave room for the study reminders. */
export const MAX_LECTURE_REMINDERS = 48;
/** "Evening before" reminders go off at this time. */
export const EVENING_BEFORE_TIME = '20:00';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** "08:30" → 510. */
export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** 510 → "08:30". Wraps round the day. */
export function fromMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The ISO weekday of a calendar date. */
export function weekdayOf(day: DayString): Weekday {
  const d = dayOfWeek(day); // 0 = Sunday
  return (d === 0 ? 7 : d) as Weekday;
}

/** The weekday `n` days after `day` (negative goes back), wrapping round the week. */
export function shiftWeekday(day: Weekday, n: number): Weekday {
  return (((((day - 1 + n) % 7) + 7) % 7) + 1) as Weekday;
}

export function isCourseColour(value: string): value is CourseColour {
  return (courseColourNames as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------------------------
// Reminders

export const reminderSchema = z.discriminatedUnion('type', [
  /** A set number of minutes before the class starts. */
  z.object({
    type: z.literal('before'),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
  }),
  /** A clock time on the day of the class (dayOffset 0) or the day before (-1). */
  z.object({
    type: z.literal('at'),
    time: z.string().regex(TIME),
    dayOffset: z.union([z.literal(0), z.literal(-1)]),
  }),
]);
export type Reminder = z.infer<typeof reminderSchema>;

/** The quick choices in the class editor. */
export const reminderPresets: readonly Reminder[] = [
  { type: 'before', minutes: 10 },
  { type: 'before', minutes: 15 },
  { type: 'before', minutes: 30 },
  { type: 'before', minutes: 60 },
  { type: 'before', minutes: 120 },
  { type: 'at', time: EVENING_BEFORE_TIME, dayOffset: -1 },
];

export function reminderKey(r: Reminder): string {
  return r.type === 'before' ? `b${r.minutes}` : `a${r.dayOffset}${r.time}`;
}

export function sameReminder(a: Reminder, b: Reminder): boolean {
  return reminderKey(a) === reminderKey(b);
}

/** Reads the saved JSON forgivingly: anything damaged is dropped, duplicates removed. */
export function parseReminders(json: string | null | undefined): Reminder[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: Reminder[] = [];
  for (const item of raw) {
    const parsed = reminderSchema.safeParse(item);
    if (parsed.success && !out.some((r) => sameReminder(r, parsed.data))) out.push(parsed.data);
  }
  return sortReminders(out).slice(0, MAX_REMINDERS_PER_CLASS);
}

/** Earliest reminder first. */
export function sortReminders(list: readonly Reminder[]): Reminder[] {
  const offset = (r: Reminder) =>
    r.type === 'before' ? -r.minutes : r.dayOffset * MINUTES_PER_DAY + toMinutes(r.time) - 100_000;
  return [...list].sort((a, b) => offset(a) - offset(b));
}

export type ReminderSlot = {
  weekday: Weekday;
  time: string;
  /** True when the time fell in the quiet hours and was moved to 07:00. */
  shifted: boolean;
};

/**
 * When a reminder for a class goes off each week. Quiet hours (22:00–07:00) are never broken: a
 * reminder that would land in them moves to 07:00 if that is still before the class on the same
 * day, and is otherwise dropped (null).
 */
export function reminderSlot(
  cls: { weekday: number; startTime: string },
  reminder: Reminder,
): ReminderSlot | null {
  const start = toMinutes(cls.startTime);
  const day = cls.weekday as Weekday;
  let at: number; // minutes from the start of the class's day; may be negative
  if (reminder.type === 'before') at = start - reminder.minutes;
  else at = reminder.dayOffset * MINUTES_PER_DAY + toMinutes(reminder.time);
  if (at > start) return null; // after the class has begun: no use
  const dayShift = Math.floor(at / MINUTES_PER_DAY);
  const time = fromMinutes(at);
  if (!isQuietTime(time)) return { weekday: shiftWeekday(day, dayShift), time, shifted: false };
  // In quiet hours: move to 07:00 on the class's own day if the class hasn't started by then.
  if (start >= QUIET_END_MINUTES && (dayShift < 0 || at < QUIET_END_MINUTES)) {
    return { weekday: day, time: fromMinutes(QUIET_END_MINUTES), shifted: true };
  }
  return null;
}

type ReminderClass = Pick<
  TimetableClass,
  'id' | 'title' | 'code' | 'kind' | 'weekday' | 'startTime' | 'location' | 'remindersJson'
>;

/**
 * Every weekly lecture reminder to schedule, soonest in the week first, capped so the phone's
 * limit isn't hit. These are the student's own choices, so the study reminders' 2-a-day cap
 * doesn't apply to them; quiet hours still do.
 */
export function planLectureReminders(classes: readonly ReminderClass[]): WeeklyNotification[] {
  const out: WeeklyNotification[] = [];
  const t = strings.timetable.notification;
  for (const cls of classes) {
    for (const reminder of parseReminders(cls.remindersJson)) {
      const slot = reminderSlot(cls, reminder);
      if (!slot) continue;
      const name = cls.code ? `${cls.code} · ${cls.title}` : cls.title;
      const minutesBefore =
        (cls.weekday === slot.weekday ? 0 : MINUTES_PER_DAY) +
        toMinutes(cls.startTime) -
        toMinutes(slot.time);
      out.push({
        id: `lecture-${cls.id}-${reminderKey(reminder)}`,
        kind: 'lecture',
        weekday: slot.weekday,
        time: slot.time,
        title: t.title(name, minutesBefore),
        body: t.body(strings.timetable.kinds[cls.kind], cls.startTime, cls.location),
      });
    }
  }
  const order = (n: WeeklyNotification) => n.weekday * MINUTES_PER_DAY + toMinutes(n.time);
  return out.sort((a, b) => order(a) - order(b)).slice(0, MAX_LECTURE_REMINDERS);
}

// ---------------------------------------------------------------------------------------------
// The class editor

export type ClassDraft = {
  title: string;
  code: string;
  kind: ClassKind;
  /** Days the class meets. A new class can be added on several days at once. */
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
  location: string;
  lecturer: string;
  colour: CourseColour;
  reminders: Reminder[];
};

export type DraftProblem = 'title' | 'days' | 'times' | null;

export function classDraftProblem(draft: ClassDraft): DraftProblem {
  if (!draft.title.trim()) return 'title';
  if (draft.weekdays.length === 0) return 'days';
  if (!isTime(draft.startTime) || !isTime(draft.endTime)) return 'times';
  if (toMinutes(draft.endTime) <= toMinutes(draft.startTime)) return 'times';
  return null;
}

/** Trims and limits the fields before saving. */
export function tidyDraft(draft: ClassDraft): ClassDraft {
  return {
    ...draft,
    title: draft.title.trim().slice(0, TITLE_MAX),
    code: draft.code.trim().slice(0, FIELD_MAX),
    location: draft.location.trim().slice(0, FIELD_MAX),
    lecturer: draft.lecturer.trim().slice(0, FIELD_MAX),
    weekdays: [...new Set(draft.weekdays)].sort(),
    reminders: sortReminders(draft.reminders).slice(0, MAX_REMINDERS_PER_CLASS),
  };
}

/** A fresh class: a 1-hour lecture at the next sensible slot, 30 min reminder, next colour. */
export function emptyDraft(weekday: Weekday, usedColours: readonly string[] = []): ClassDraft {
  const unused = courseColourNames.find((c) => !usedColours.includes(c));
  return {
    title: '',
    code: '',
    kind: 'lecture',
    weekdays: [weekday],
    startTime: '08:00',
    endTime: '10:00',
    location: '',
    lecturer: '',
    colour: unused ?? courseColourNames[usedColours.length % courseColourNames.length],
    reminders: [{ type: 'before', minutes: 30 }],
  };
}

export function classToDraft(cls: TimetableClass): ClassDraft {
  return {
    title: cls.title,
    code: cls.code,
    kind: cls.kind,
    weekdays: [cls.weekday as Weekday],
    startTime: cls.startTime,
    endTime: cls.endTime,
    location: cls.location,
    lecturer: cls.lecturer,
    colour: isCourseColour(cls.colour) ? cls.colour : 'teal',
    reminders: parseReminders(cls.remindersJson),
  };
}

/** Moves the end time with the start time, keeping the class's length (default 1 hour). */
export function withStartTime(draft: ClassDraft, startTime: string): ClassDraft {
  const length = Math.max(15, toMinutes(draft.endTime) - toMinutes(draft.startTime)) || 60;
  const end = Math.min(toMinutes(startTime) + length, MINUTES_PER_DAY - 1);
  return { ...draft, startTime, endTime: fromMinutes(end) };
}

// ---------------------------------------------------------------------------------------------
// Days, now and next

type Slot = Pick<TimetableClass, 'weekday' | 'startTime' | 'endTime'>;

/** The classes on one weekday, earliest first. */
export function classesOn<T extends Slot & { title: string }>(
  classes: readonly T[],
  weekday: Weekday,
): T[] {
  return classes
    .filter((c) => c.weekday === weekday)
    .sort(
      (a, b) =>
        toMinutes(a.startTime) - toMinutes(b.startTime) ||
        toMinutes(a.endTime) - toMinutes(b.endTime) ||
        a.title.localeCompare(b.title),
    );
}

/** Monday to Friday, plus Saturday and Sunday when a class meets then. */
export function visibleWeekdays(classes: readonly Slot[]): Weekday[] {
  const used = new Set(classes.map((c) => c.weekday));
  return weekdays.filter((d) => d <= 5 || used.has(d));
}

export type Moment = { weekday: Weekday; minutes: number };

export type NowAndNext<T> = {
  /** The class going on right now, if any, and how far through it is (0–1). */
  current: { cls: T; progress: number; minutesLeft: number } | null;
  /** The next class to start (within the coming week), and how long until it does. */
  next: { cls: T; minutesUntil: number; daysAhead: number } | null;
};

/** What is on now and what is next, looking up to a week ahead. */
export function nowAndNext<T extends Slot & { title: string }>(
  classes: readonly T[],
  now: Moment,
): NowAndNext<T> {
  let current: NowAndNext<T>['current'] = null;
  for (const cls of classesOn(classes, now.weekday)) {
    const start = toMinutes(cls.startTime);
    const end = toMinutes(cls.endTime);
    if (start <= now.minutes && now.minutes < end) {
      current = {
        cls,
        progress: (now.minutes - start) / Math.max(1, end - start),
        minutesLeft: end - now.minutes,
      };
      break;
    }
  }
  let next: NowAndNext<T>['next'] = null;
  for (let ahead = 0; ahead <= 7 && !next; ahead++) {
    const day = shiftWeekday(now.weekday, ahead);
    for (const cls of classesOn(classes, day)) {
      const start = toMinutes(cls.startTime);
      if (ahead === 0 && start <= now.minutes) continue;
      if (ahead === 7 && start > now.minutes) break;
      next = { cls, minutesUntil: ahead * MINUTES_PER_DAY + start - now.minutes, daysAhead: ahead };
      break;
    }
  }
  return { current, next };
}

/** "in 5 min", "in 1 h 20 min", "tomorrow at 08:00", "on Thursday at 08:00". */
export function describeUntil(
  next: { minutesUntil: number; daysAhead: number },
  startTime: string,
  nextDay: Weekday,
): string {
  const t = strings.timetable;
  if (next.daysAhead === 0) return t.inMinutes(next.minutesUntil);
  if (next.daysAhead === 1) return t.tomorrowAt(startTime);
  return t.onDayAt(t.weekdays[nextDay], startTime);
}

// ---------------------------------------------------------------------------------------------
// The week grid

export type GridRange = { startHour: number; endHour: number };

/** The hours the week grid shows: at least 08:00–17:00, stretched to fit every class. */
export function gridRange(classes: readonly Slot[]): GridRange {
  let startHour = 8;
  let endHour = 17;
  for (const c of classes) {
    startHour = Math.min(startHour, Math.floor(toMinutes(c.startTime) / 60));
    endHour = Math.max(endHour, Math.ceil(toMinutes(c.endTime) / 60));
  }
  return { startHour, endHour: Math.min(24, Math.max(endHour, startHour + 1)) };
}

export type PlacedClass<T> = {
  cls: T;
  /** Minutes from the top of the grid. */
  top: number;
  /** Length in minutes. */
  length: number;
  /** Side-by-side lanes for classes that overlap: this one's lane, and how many lanes. */
  lane: number;
  lanes: number;
};

/**
 * Lays out one day's classes for the week grid. Classes that overlap share the column in
 * side-by-side lanes, so none hides another.
 */
export function layoutDay<T extends Slot & { title: string }>(
  dayClasses: readonly T[],
  range: GridRange,
): PlacedClass<T>[] {
  const sorted = classesOn(dayClasses, (dayClasses[0]?.weekday ?? 1) as Weekday);
  const placed: PlacedClass<T>[] = [];
  let group: PlacedClass<T>[] = [];
  let groupEnd = -1;
  const laneEnds: number[] = [];
  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds.length = 0;
  };
  for (const cls of sorted) {
    const start = toMinutes(cls.startTime);
    const end = Math.max(start + 15, toMinutes(cls.endTime));
    if (start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    const p: PlacedClass<T> = {
      cls,
      top: start - range.startHour * 60,
      length: end - start,
      lane,
      lanes: 1,
    };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, end);
  }
  closeGroup();
  return placed;
}

/** Total teaching time in a list of classes, in minutes. */
export function totalMinutes(classes: readonly Slot[]): number {
  return classes.reduce(
    (sum, c) => sum + Math.max(0, toMinutes(c.endTime) - toMinutes(c.startTime)),
    0,
  );
}

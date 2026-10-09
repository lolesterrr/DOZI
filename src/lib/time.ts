import { addDays as addCalendarDays, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// The one place the app reads the clock and works out dates (ARCHITECTURE §7.1).
// Streak, XP-per-day and planner logic must use these helpers, never `new Date()` directly.

/** The timezone used when the profile doesn't say otherwise. */
export const DEFAULT_TIMEZONE = 'Africa/Kampala';

/** A study day starts at this local hour, so late-night study counts for the day before. */
export const STUDY_DAY_ROLLOVER_HOUR = 3;

/** A calendar date as `YYYY-MM-DD`, e.g. a study day. */
export type DayString = string;

/** Anything that names an instant: a Date, an ISO-8601 string or epoch milliseconds. */
export type Instant = Date | string | number;

/** Returns the current instant. Pass a fake one in tests to "time-travel". */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDate(instant: Instant): Date {
  const date = typeof instant === 'string' ? parseISO(instant) : new Date(instant);
  if (!isValid(date)) throw new RangeError(`Not a valid date/time: ${String(instant)}`);
  return date;
}

function assertTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown timezone: ${timeZone}`);
}

function assertDay(day: DayString): void {
  if (!isDayString(day)) throw new RangeError(`Not a YYYY-MM-DD date: ${day}`);
}

/** The current time as an ISO-8601 UTC string — the format every `*_at` column uses. */
export function nowIso(clock: Clock = systemClock): string {
  return clock().toISOString();
}

/** Any instant as an ISO-8601 UTC string. */
export function toIso(instant: Instant): string {
  return toDate(instant).toISOString();
}

/** True for an IANA timezone name the device knows, like `Africa/Kampala`. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isDayString(value: string): boolean {
  return DAY_PATTERN.test(value) && isValid(parseISO(value));
}

/** The calendar date at `instant` on a wall clock in `timeZone`, as `YYYY-MM-DD`. */
export function localDate(instant: Instant, timeZone: string = DEFAULT_TIMEZONE): DayString {
  assertTimeZone(timeZone);
  return formatInTimeZone(toDate(instant), timeZone, 'yyyy-MM-dd');
}

/**
 * The study day an instant belongs to, as `YYYY-MM-DD`. The day rolls over at 03:00 local time,
 * so 02:59 still counts for the day before and 03:00 starts the new day.
 *
 * This reads the local wall clock rather than subtracting 3 hours from the instant, so it stays
 * right on days when clocks change (daylight saving) in timezones that have them.
 */
export function studyDay(instant: Instant, timeZone: string = DEFAULT_TIMEZONE): DayString {
  assertTimeZone(timeZone);
  const [date, hour] = formatInTimeZone(toDate(instant), timeZone, 'yyyy-MM-dd HH').split(' ');
  return Number(hour) < STUDY_DAY_ROLLOVER_HOUR ? addDays(date, -1) : date;
}

/** Today's study day. */
export function currentStudyDay(
  timeZone: string = DEFAULT_TIMEZONE,
  clock: Clock = systemClock,
): DayString {
  return studyDay(clock(), timeZone);
}

/** The instant a study day begins (03:00 local time on that date), as an ISO-8601 UTC string. */
export function studyDayStart(day: DayString, timeZone: string = DEFAULT_TIMEZONE): string {
  assertDay(day);
  assertTimeZone(timeZone);
  const hour = String(STUDY_DAY_ROLLOVER_HOUR).padStart(2, '0');
  return fromZonedTime(`${day}T${hour}:00:00`, timeZone).toISOString();
}

/** The instant a study day ends (the next day's start; exclusive), as an ISO-8601 UTC string. */
export function studyDayEnd(day: DayString, timeZone: string = DEFAULT_TIMEZONE): string {
  return studyDayStart(addDays(day, 1), timeZone);
}

/** Moves a `YYYY-MM-DD` date by whole days (negative goes back). */
export function addDays(day: DayString, amount: number): DayString {
  assertDay(day);
  return formatDay(addCalendarDays(parseISO(day), amount));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DayString, to: DayString): number {
  assertDay(from);
  assertDay(to);
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** Every date from `from` to `to`, both included. Empty if `to` is before `from`. */
export function dayRange(from: DayString, to: DayString): DayString[] {
  const count = daysBetween(from, to);
  return Array.from({ length: Math.max(0, count + 1) }, (_, i) => addDays(from, i));
}

/** Day of the week for a `YYYY-MM-DD` date: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(day: DayString): number {
  assertDay(day);
  return parseISO(day).getDay();
}

// parseISO reads a bare date as local midnight, so format it back in the same local frame.
function formatDay(date: Date): DayString {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

import {
  greetingContext,
  messageMood,
  pickMessage,
  type DoziMood,
  type MascotContext,
} from '@/features/mascot';
import { daysBetween, type DayString } from '@/lib/time';

// Pure rules for the Today screen (PRODUCT_SPEC §2): what Dozi says, and the "recent items"
// list. No React, no database.

export type Greeting = { context: MascotContext; mood: DoziMood; message: string };

export type GreetingInput = {
  /** The hour of the day (0–23) in the student's timezone. */
  hour: number;
  /** The study day, to vary the line from day to day. */
  day: DayString;
  /** Days in the streak and whether today has counted yet. */
  streakDays: number;
  todayCounted: boolean;
  goalMet: boolean;
};

/** Streaks shorter than this don't get the "keep it alive" nudge: a 1-day streak is no burden. */
export const STREAK_NUDGE_MIN_DAYS = 2;
/** The "streak at risk" line only appears from this hour (never at night, see quiet hours). */
export const STREAK_NUDGE_FROM_HOUR = 17;
export const STREAK_NUDGE_BEFORE_HOUR = 22;

/** A number that changes every day, for picking one of several lines. */
export function dayNumber(day: DayString): number {
  return daysBetween('2026-01-01', day);
}

/**
 * Dozi's greeting. A reached goal is celebrated; at night Dozi is sleepy; in the evening, with a
 * streak worth keeping and nothing earned yet, there is a light reminder; otherwise it is
 * a hello for the time of day.
 */
export function chooseGreeting(input: GreetingInput): Greeting {
  const seed = dayNumber(input.day);
  const night = input.hour >= STREAK_NUDGE_BEFORE_HOUR || input.hour < 5;
  let context: MascotContext;
  if (night) context = 'greetingLate';
  else if (input.goalMet) context = 'goalReached';
  else if (
    input.streakDays >= STREAK_NUDGE_MIN_DAYS &&
    !input.todayCounted &&
    input.hour >= STREAK_NUDGE_FROM_HOUR
  ) {
    context = 'streakAtRisk';
  } else context = greetingContext(input.hour);
  return { context, mood: messageMood(context), message: pickMessage(context, seed) };
}

// ---------------------------------------------------------------------------------------------
// Recent items

export type RecentKind = 'note' | 'deck' | 'quiz';

export type RecentItem = { kind: RecentKind; id: string; title: string; updatedAt: string };

/** The most recently changed items from every kind, newest first. */
export function mergeRecent(items: readonly RecentItem[], limit: number): RecentItem[] {
  return [...items]
    .sort((a, b) =>
      a.updatedAt === b.updatedAt ? a.id.localeCompare(b.id) : a.updatedAt < b.updatedAt ? 1 : -1,
    )
    .slice(0, Math.max(0, limit));
}

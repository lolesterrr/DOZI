import { addDays, dayRange, daysBetween, type DayString } from '@/lib/time';

import { STREAK_MIN_XP } from './logic';

// The streak calculator (PRODUCT_SPEC §8.2, ARCHITECTURE §7.2). Pure: it replays the XP earned
// on each study day and works out the streak, so the result is always the same for the same
// history (also after a sync brings XP from another phone). Study days already roll over at
// 03:00 (src/lib/time.ts); this file only sees `YYYY-MM-DD` strings.
//
// Rules, in short:
//  - A day counts when it has at least 10 XP (STREAK_MIN_XP).
//  - A missed day uses a streak freeze if one is held; otherwise the streak breaks.
//  - A freeze is earned at every 7-day milestone (7, 14, 21…). At most 2 are held.
//  - Repair: after a break, earning 2 × the daily goal in the next 48 hours (the two study days
//    after the missed day) brings the streak back, once every 30 days. It happens by itself.

export const FREEZE_EVERY_DAYS = 7;
export const MAX_FREEZES = 2;
/** The repair window: this many study days after the missed day (48 hours). */
export const REPAIR_WINDOW_DAYS = 2;
/** After a repair, the next one needs a break at least this many days later. */
export const REPAIR_COOLDOWN_DAYS = 30;
/** XP to earn in the window, as a multiple of the daily goal. */
export const REPAIR_GOAL_MULTIPLE = 2;

export type StreakInput = {
  /** XP earned on each study day. Days without XP can be left out. */
  xpByDay: Readonly<Record<DayString, number>>;
  /** The current study day. Today is never "missed": it isn't over yet. */
  today: DayString;
  /** The student's daily goal in XP (for the repair target). */
  dailyGoal: number;
};

export type StreakRepair = {
  /** The study day the break happened on (the day nothing was earned). */
  brokenDay: DayString;
  /** The streak that was lost, and comes back if the repair is completed. */
  lostStreak: number;
  /** The last study day (inclusive) to finish the repair. */
  until: DayString;
  /** XP earned so far in the window and the target. */
  earned: number;
  target: number;
};

export type StreakResult = {
  /** Days in a row, today included once it has counted. 0 when there is no streak. */
  current: number;
  longest: number;
  /** True once today has 10 XP. */
  todayCounted: boolean;
  /** The streak is alive but today hasn't counted yet (a gentle reminder, never a warning). */
  atRisk: boolean;
  freezesHeld: number;
  /** The last day that counted. */
  lastCountedDay: DayString | null;
  /** Days a freeze covered. */
  frozenDays: DayString[];
  /** An open repair, or null (none needed, expired, or not allowed yet). */
  repair: StreakRepair | null;
  /** The study day a repair was completed on, if the latest break was repaired. */
  lastRepairDay: DayString | null;
  /** Every day a repair restored (for a calendar). */
  repairedBreaks: DayString[];
};

type Pending = { brokenDay: DayString; lostStreak: number };

export function counts(xp: number | undefined): boolean {
  return (xp ?? 0) >= STREAK_MIN_XP;
}

/** Works out the streak from the XP of each study day. */
export function calculateStreak({ xpByDay, today, dailyGoal }: StreakInput): StreakResult {
  const countedDays = Object.keys(xpByDay)
    .filter((day) => counts(xpByDay[day]) && day <= today)
    .sort();
  const target = Math.max(0, dailyGoal) * REPAIR_GOAL_MULTIPLE;

  let current = 0;
  let longest = 0;
  let freezes = 0;
  let lastCounted: DayString | null = null;
  let lastRepair: DayString | null = null;
  let pending: Pending | null = null;
  const frozenDays: DayString[] = [];
  const repairedBreaks: DayString[] = [];

  /** Adds days to the streak, earning a freeze for every 7-day milestone passed. */
  const extend = (by: number) => {
    const before = current;
    current += by;
    const earned = Math.floor(current / FREEZE_EVERY_DAYS) - Math.floor(before / FREEZE_EVERY_DAYS);
    freezes = Math.min(MAX_FREEZES, freezes + Math.max(0, earned));
    longest = Math.max(longest, current);
  };

  /** XP in the repair window up to and including `upTo`. */
  const windowXp = (p: Pending, upTo: DayString) =>
    dayRange(
      addDays(p.brokenDay, 1),
      minDay(upTo, addDays(p.brokenDay, REPAIR_WINDOW_DAYS)),
    ).reduce((sum, day) => sum + (xpByDay[day] ?? 0), 0);

  const canRepair = (p: Pending) =>
    target > 0 &&
    (lastRepair === null || daysBetween(lastRepair, p.brokenDay) >= REPAIR_COOLDOWN_DAYS);

  /** Applies a repair as soon as the window's XP reaches the target. */
  const tryRepair = (day: DayString) => {
    if (!pending || !canRepair(pending)) return;
    if (windowXp(pending, day) < target) return;
    // The missed day is filled in: the old streak continues, plus the days counted since.
    // Freezes already earned for the lost days are not earned twice.
    const restored = pending.lostStreak + current;
    const earned =
      Math.floor(restored / FREEZE_EVERY_DAYS) - Math.floor(pending.lostStreak / FREEZE_EVERY_DAYS);
    freezes = Math.min(MAX_FREEZES, freezes + Math.max(0, earned));
    current = restored;
    longest = Math.max(longest, current);
    repairedBreaks.push(pending.brokenDay);
    lastRepair = day;
    pending = null;
  };

  if (countedDays.length > 0) {
    for (const day of dayRange(countedDays[0], today)) {
      const isToday = day === today;
      // The window closed on an earlier day: that break is permanent.
      if (pending && day > addDays(pending.brokenDay, REPAIR_WINDOW_DAYS)) pending = null;
      if (counts(xpByDay[day])) {
        extend(1);
        lastCounted = day;
      } else if (!isToday && current > 0) {
        if (freezes > 0) {
          freezes -= 1;
          frozenDays.push(day);
        } else {
          // A second miss inside an open window keeps the first break (the streak worth repairing).
          pending ??= { brokenDay: day, lostStreak: current };
          current = 0;
        }
      }
      tryRepair(day);
    }
  }

  const todayCounted = counts(xpByDay[today]);
  const open = pending as Pending | null;
  const repair: StreakRepair | null =
    open && canRepair(open)
      ? {
          brokenDay: open.brokenDay,
          lostStreak: open.lostStreak,
          until: addDays(open.brokenDay, REPAIR_WINDOW_DAYS),
          earned: windowXp(open, today),
          target,
        }
      : null;

  return {
    current,
    longest,
    todayCounted,
    atRisk: current > 0 && !todayCounted,
    freezesHeld: freezes,
    lastCountedDay: lastCounted,
    frozenDays,
    repair,
    lastRepairDay: lastRepair,
    repairedBreaks,
  };
}

function minDay(a: DayString, b: DayString): DayString {
  return a < b ? a : b;
}

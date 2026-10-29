import type { XpSource } from '@/db/schema';

// Pure rules for XP, the daily goal and levels (PRODUCT_SPEC §8.1, §8.3). No React, no database:
// the rules table below is the one place to tune the numbers, and everything is unit-tested.

// ---------------------------------------------------------------------------------------------
// XP rules

/**
 * How often the same thing (a card, an attempt, a note) can earn XP:
 *  - `none`   — every award counts;
 *  - `perDay` — once per study day for the same `sourceId`;
 *  - `once`   — once, ever, for the same `sourceId`.
 */
export type XpDedupe = 'none' | 'perDay' | 'once';

export type XpRule = {
  /** XP for one thing. */
  amount: number;
  dedupe: XpDedupe;
  /** The most XP this source can give in one study day (leave out for no limit). */
  dailyCap?: number;
};

export const xpRules: Record<XpSource, XpRule> = {
  review_card: { amount: 1, dedupe: 'perDay' },
  quiz_correct_own: { amount: 1, dedupe: 'once' },
  quiz_correct_official: { amount: 2, dedupe: 'once' },
  lesson_complete: { amount: 10, dedupe: 'none' },
  lesson_all_correct: { amount: 5, dedupe: 'none' },
  practice_node: { amount: 10, dedupe: 'none' },
  checkpoint_pass: { amount: 25, dedupe: 'none' },
  checkpoint_three_stars: { amount: 10, dedupe: 'none' },
  mock_exam: { amount: 50, dedupe: 'none' },
  card_created: { amount: 1, dedupe: 'once', dailyCap: 20 },
  note_created: { amount: 2, dedupe: 'once', dailyCap: 10 },
  daily_goal_bonus: { amount: 5, dedupe: 'perDay' },
  error_report_accepted: { amount: 20, dedupe: 'once' },
};

/** A note earns XP once it is longer than this many words. */
export const NOTE_XP_MIN_WORDS = 100;

/** The XP a student needs in one study day to keep their streak (PRODUCT_SPEC §8.2). */
export const STREAK_MIN_XP = 10;

/** The default daily goal (the profile's `daily_goal_xp` default). */
export const DEFAULT_DAILY_GOAL_XP = 50;

/** The shortest and longest daily goal the student can pick. */
export const MIN_DAILY_GOAL_XP = 10;
export const MAX_DAILY_GOAL_XP = 500;

// ---------------------------------------------------------------------------------------------
// Awarding

/** What the rules need to know about XP already earned. */
export type XpEventLike = { source: XpSource; sourceId: string | null; amount: number };

export type PlanAwardInput = {
  source: XpSource;
  sourceId: string | null;
  /** How many things (e.g. the correct answers in one attempt) this award is for. Default 1. */
  count?: number;
  /** Every XP event already saved for this study day. */
  today: readonly XpEventLike[];
  /** True when an event with this source and `sourceId` was ever saved (for `once` rules). */
  everAwarded: boolean;
  /** The study day (`YYYY-MM-DD`), used as the daily goal bonus's `sourceId`. */
  day: string;
  /** The student's daily goal in XP; 0 or less means no goal. */
  dailyGoal: number;
};

export type PlannedEvent = { source: XpSource; sourceId: string | null; amount: number };

export type AwardPlan = {
  /** What to save: the award itself (if it earns anything) and the goal bonus (if it is reached). */
  events: PlannedEvent[];
  /** XP earned by this award, the bonus included. */
  total: number;
  /** True when this award is the one that reached the daily goal. */
  goalReached: boolean;
};

const nothing: AwardPlan = { events: [], total: 0, goalReached: false };

/**
 * Works out what an action earns today, applying the rule's repeat limit and daily cap, and the
 * daily goal bonus when the day's XP first reaches the goal. The bonus itself never counts
 * towards the goal.
 */
export function planAward(input: PlanAwardInput): AwardPlan {
  const rule = xpRules[input.source];
  const count = Math.max(0, Math.floor(input.count ?? 1));
  if (count === 0) return nothing;

  if (rule.dedupe === 'once' && input.everAwarded) return nothing;
  if (
    rule.dedupe === 'perDay' &&
    input.today.some((e) => e.source === input.source && e.sourceId === input.sourceId)
  ) {
    return nothing;
  }

  let amount = rule.amount * count;
  if (rule.dailyCap !== undefined) {
    const earnedToday = input.today
      .filter((e) => e.source === input.source)
      .reduce((sum, e) => sum + e.amount, 0);
    amount = Math.min(amount, Math.max(0, rule.dailyCap - earnedToday));
  }
  if (amount <= 0) return nothing;

  const events: PlannedEvent[] = [{ source: input.source, sourceId: input.sourceId, amount }];
  let total = amount;

  let goalReached = false;
  if (input.source !== 'daily_goal_bonus' && input.dailyGoal > 0) {
    const bonusGiven = input.today.some((e) => e.source === 'daily_goal_bonus');
    const before = earnedExcludingBonus(input.today);
    if (!bonusGiven && before < input.dailyGoal && before + amount >= input.dailyGoal) {
      const bonus = xpRules.daily_goal_bonus.amount;
      events.push({ source: 'daily_goal_bonus', sourceId: input.day, amount: bonus });
      total += bonus;
      goalReached = true;
    }
  }
  return { events, total, goalReached };
}

function earnedExcludingBonus(events: readonly XpEventLike[]): number {
  return events
    .filter((e) => e.source !== 'daily_goal_bonus')
    .reduce((sum, e) => sum + e.amount, 0);
}

/** XP earned in a study day. The goal bonus counts here (it is real XP) but not for the goal. */
export function sumXp(events: readonly { amount: number }[]): number {
  return events.reduce((sum, e) => sum + e.amount, 0);
}

// ---------------------------------------------------------------------------------------------
// Daily goal

export type DailyGoalProgress = {
  xp: number;
  goal: number;
  /** 0 to 1, for the progress ring. */
  fraction: number;
  met: boolean;
  /** XP still needed to meet the goal (0 once met). */
  remaining: number;
};

/** `todayXp` is the day's XP without the goal bonus (see `goalXp`). */
export function dailyGoalProgress(todayXp: number, goal: number): DailyGoalProgress {
  const xp = Math.max(0, todayXp);
  if (goal <= 0) return { xp, goal: 0, fraction: 0, met: false, remaining: 0 };
  return {
    xp,
    goal,
    fraction: Math.min(1, xp / goal),
    met: xp >= goal,
    remaining: Math.max(0, goal - xp),
  };
}

/** The part of a day's XP that counts towards the daily goal (everything but the bonus). */
export function goalXp(events: readonly XpEventLike[]): number {
  return earnedExcludingBonus(events);
}

/** True for a daily goal the student may pick: a whole number from 10 to 500. */
export function isValidDailyGoal(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_DAILY_GOAL_XP && value <= MAX_DAILY_GOAL_XP;
}

// ---------------------------------------------------------------------------------------------
// Levels

export const MAX_LEVEL = 50;

/** Cumulative XP at which a level starts: level 1 at 0, level 2 at 40, level 50 at about 20 000. */
export function xpForLevel(level: number): number {
  const n = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return n === 1 ? 0 : Math.round(40 * (n - 1) ** 1.6);
}

/** The level for a total XP (1 to 50). */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Titles, each starting at a level. A new title every 5 levels, until the last one. */
export const levelTitles = [
  { key: 'intern', fromLevel: 1 },
  { key: 'dispenser', fromLevel: 5 },
  { key: 'compounder', fromLevel: 10 },
  { key: 'pharmacologist', fromLevel: 15 },
  { key: 'clinicalPharmacist', fromLevel: 20 },
  { key: 'professor', fromLevel: 25 },
] as const;
export type LevelTitleKey = (typeof levelTitles)[number]['key'];

export function titleForLevel(level: number): LevelTitleKey {
  let title: LevelTitleKey = levelTitles[0].key;
  for (const entry of levelTitles) if (level >= entry.fromLevel) title = entry.key;
  return title;
}

export type LevelProgress = {
  level: number;
  title: LevelTitleKey;
  totalXp: number;
  /** XP earned since this level began. */
  xpIntoLevel: number;
  /** XP from the start of this level to the start of the next (0 at the top level). */
  xpForNext: number;
  /** 0 to 1 through this level (1 at the top level). */
  fraction: number;
  maxed: boolean;
};

export function levelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = levelForXp(xp);
  const maxed = level >= MAX_LEVEL;
  const start = xpForLevel(level);
  const span = maxed ? 0 : xpForLevel(level + 1) - start;
  return {
    level,
    title: titleForLevel(level),
    totalXp: xp,
    xpIntoLevel: xp - start,
    xpForNext: span,
    fraction: maxed ? 1 : (xp - start) / span,
    maxed,
  };
}

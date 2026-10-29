import { and, eq, isNull, sql } from 'drizzle-orm';

import {
  profiles,
  streakState,
  xpEvents,
  type StreakStateRow,
  type XpEvent,
  type XpSource,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { DEFAULT_TIMEZONE, nowIso, studyDay, type DayString } from '@/lib/time';

import {
  DEFAULT_DAILY_GOAL_XP,
  goalXp,
  levelForXp,
  planAward,
  sumXp,
  type PlannedEvent,
} from './logic';
import { calculateStreak, type StreakResult } from './streak';

type Deps = { newId?: () => string; now?: () => string };

const isoNow = () => nowIso();

export type AwardInput = {
  ownerId: string;
  source: XpSource;
  /** What the XP is for (a card instance, an attempt, a note…); lets the rules avoid paying twice. */
  sourceId?: string | null;
  /** How many things this is for (default 1), e.g. the correct answers in one attempt. */
  count?: number;
};

export type AwardResult = {
  /** The rows saved (empty when the rules gave nothing). */
  events: XpEvent[];
  /** XP earned by this award, the goal bonus included. */
  xp: number;
  goalReached: boolean;
  /** Set when this award took the student to a new level. */
  levelUp: { from: number; to: number } | null;
  /** The streak after this award (null when nothing was earned). */
  streak: StreakResult | null;
  /** This award made today count for the streak (10 XP reached). */
  streakExtended: boolean;
  /** This award completed a streak repair. */
  streakRepaired: boolean;
};

const noAward: AwardResult = {
  events: [],
  xp: 0,
  goalReached: false,
  levelUp: null,
  streak: null,
  streakExtended: false,
  streakRepaired: false,
};

/**
 * Gives XP for something the student did (PRODUCT_SPEC §8.1), following the rules in
 * `logic.ts`: repeat limits, daily caps and the daily goal bonus. The study day, timezone and
 * daily goal come from the student's profile. Everything happens in one transaction.
 */
export async function awardXp(
  db: AppDatabase,
  input: AwardInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<AwardResult> {
  const timestamp = now();
  return db.transaction((tx) => {
    const [profile] = tx
      .select({ timezone: profiles.timezone, dailyGoalXp: profiles.dailyGoalXp })
      .from(profiles)
      .where(eq(profiles.id, input.ownerId))
      .limit(1)
      .all();
    const day = studyDay(timestamp, profile?.timezone ?? DEFAULT_TIMEZONE);
    const sourceId = input.sourceId ?? null;

    const today = tx
      .select()
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.ownerId, input.ownerId),
          eq(xpEvents.studyDay, day),
          isNull(xpEvents.deletedAt),
        ),
      )
      .all();
    const everAwarded =
      sourceId !== null &&
      tx
        .select({ id: xpEvents.id })
        .from(xpEvents)
        .where(
          and(
            eq(xpEvents.ownerId, input.ownerId),
            eq(xpEvents.source, input.source),
            eq(xpEvents.sourceId, sourceId),
            isNull(xpEvents.deletedAt),
          ),
        )
        .limit(1)
        .all().length > 0;

    const goal = profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP;
    const plan = planAward({
      source: input.source,
      sourceId,
      count: input.count,
      today,
      everAwarded,
      day,
      dailyGoal: goal,
    });
    if (plan.events.length === 0) return noAward;

    const before = totalXpOf(tx, input.ownerId);
    const daysBefore = xpByDayOf(tx, input.ownerId);
    const events = save(tx, input.ownerId, day, plan.events, timestamp, newId);
    const levelFrom = levelForXp(before);
    const levelTo = levelForXp(before + plan.total);
    const streakBefore = calculateStreak({ xpByDay: daysBefore, today: day, dailyGoal: goal });
    const streakAfter = calculateStreak({
      xpByDay: { ...daysBefore, [day]: (daysBefore[day] ?? 0) + plan.total },
      today: day,
      dailyGoal: goal,
    });
    writeStreakState(tx, input.ownerId, streakAfter, timestamp);
    return {
      events,
      xp: plan.total,
      goalReached: plan.goalReached,
      levelUp: levelTo > levelFrom ? { from: levelFrom, to: levelTo } : null,
      streak: streakAfter,
      streakExtended: streakAfter.todayCounted && !streakBefore.todayCounted,
      streakRepaired: streakAfter.repairedBreaks.length > streakBefore.repairedBreaks.length,
    };
  });
}

function save(
  tx: Pick<AppDatabase, 'insert'>,
  ownerId: string,
  day: string,
  planned: PlannedEvent[],
  timestamp: string,
  newId: () => string,
): XpEvent[] {
  return tx
    .insert(xpEvents)
    .values(
      planned.map((e) => ({
        id: newId(),
        ownerId,
        studyDay: day,
        source: e.source,
        sourceId: e.sourceId,
        amount: e.amount,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    )
    .returning()
    .all();
}

function totalXpOf(tx: Pick<AppDatabase, 'select'>, ownerId: string): number {
  const [row] = tx
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(and(eq(xpEvents.ownerId, ownerId), isNull(xpEvents.deletedAt)))
    .all();
  return Number(row?.total ?? 0);
}

/** All the XP the student has earned. */
export async function getTotalXp(db: AppDatabase, ownerId: string): Promise<number> {
  return totalXpOf(db, ownerId);
}

export type DayXp = {
  /** Everything earned that day, the goal bonus included. */
  total: number;
  /** What counts towards the daily goal (everything but the bonus). */
  forGoal: number;
  events: XpEvent[];
};

/** The XP of one study day. */
export async function getDayXp(db: AppDatabase, ownerId: string, day: string): Promise<DayXp> {
  const events = await db
    .select()
    .from(xpEvents)
    .where(
      and(eq(xpEvents.ownerId, ownerId), eq(xpEvents.studyDay, day), isNull(xpEvents.deletedAt)),
    );
  return { total: sumXp(events), forGoal: goalXp(events), events };
}

// ---------------------------------------------------------------------------------------------
// Streak

/** XP earned on each study day (deleted events left out). */
function xpByDayOf(tx: Pick<AppDatabase, 'select'>, ownerId: string): Record<DayString, number> {
  const rows = tx
    .select({
      day: xpEvents.studyDay,
      total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`,
    })
    .from(xpEvents)
    .where(and(eq(xpEvents.ownerId, ownerId), isNull(xpEvents.deletedAt)))
    .groupBy(xpEvents.studyDay)
    .all();
  return Object.fromEntries(rows.map((r) => [r.day, Number(r.total)]));
}

/** Saves the streak summary (one row per student), only when something changed. */
function writeStreakState(
  tx: Pick<AppDatabase, 'select' | 'insert' | 'update'>,
  ownerId: string,
  streak: StreakResult,
  timestamp: string,
) {
  const next = {
    current: streak.current,
    longest: streak.longest,
    lastCountedDay: streak.lastCountedDay,
    freezesHeld: streak.freezesHeld,
    repairAvailableUntil: streak.repair?.until ?? null,
    lastRepairDay: streak.lastRepairDay,
  };
  const [row] = tx
    .select()
    .from(streakState)
    .where(eq(streakState.ownerId, ownerId))
    .limit(1)
    .all();
  if (!row) {
    tx.insert(streakState)
      .values({ ownerId, ...next, createdAt: timestamp, updatedAt: timestamp })
      .run();
    return;
  }
  const same = (Object.keys(next) as (keyof typeof next)[]).every((key) => row[key] === next[key]);
  if (same && row.deletedAt === null) return;
  tx.update(streakState)
    .set({ ...next, deletedAt: null, updatedAt: timestamp, dirty: true })
    .where(eq(streakState.ownerId, ownerId))
    .run();
}

/**
 * Works out the streak as of now from the XP history and saves it. Call it when the app opens
 * (a missed day changes the streak without any XP being earned) and after a sync.
 */
export async function refreshStreak(
  db: AppDatabase,
  ownerId: string,
  { now = isoNow }: Pick<Deps, 'now'> = {},
): Promise<StreakResult> {
  const timestamp = now();
  return db.transaction((tx) => {
    const [profile] = tx
      .select({ timezone: profiles.timezone, dailyGoalXp: profiles.dailyGoalXp })
      .from(profiles)
      .where(eq(profiles.id, ownerId))
      .limit(1)
      .all();
    const streak = calculateStreak({
      xpByDay: xpByDayOf(tx, ownerId),
      today: studyDay(timestamp, profile?.timezone ?? DEFAULT_TIMEZONE),
      dailyGoal: profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP,
    });
    writeStreakState(tx, ownerId, streak, timestamp);
    return streak;
  });
}

/** The saved streak summary, if any. */
export async function getStreakState(
  db: AppDatabase,
  ownerId: string,
): Promise<StreakStateRow | undefined> {
  const [row] = await db
    .select()
    .from(streakState)
    .where(eq(streakState.ownerId, ownerId))
    .limit(1);
  return row;
}

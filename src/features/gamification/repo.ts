import { and, eq, isNull, sql } from 'drizzle-orm';

import { profiles, xpEvents, type XpEvent, type XpSource } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { DEFAULT_TIMEZONE, nowIso, studyDay } from '@/lib/time';

import {
  DEFAULT_DAILY_GOAL_XP,
  goalXp,
  levelForXp,
  planAward,
  sumXp,
  type PlannedEvent,
} from './logic';

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

    const plan = planAward({
      source: input.source,
      sourceId,
      count: input.count,
      today,
      everAwarded,
      day,
      dailyGoal: profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP,
    });
    if (plan.events.length === 0) return { events: [], xp: 0, goalReached: false, levelUp: null };

    const before = totalXpOf(tx, input.ownerId);
    const events = save(tx, input.ownerId, day, plan.events, timestamp, newId);
    const levelFrom = levelForXp(before);
    const levelTo = levelForXp(before + plan.total);
    return {
      events,
      xp: plan.total,
      goalReached: plan.goalReached,
      levelUp: levelTo > levelFrom ? { from: levelFrom, to: levelTo } : null,
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

import { and, eq, isNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useCallback, useEffect, useMemo } from 'react';

import { useToast } from '@/components/ui';
import { useDatabase } from '@/db/DatabaseProvider';
import { xpEvents, type XpSource } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { currentStudyDay, DEFAULT_TIMEZONE } from '@/lib/time';

import {
  dailyGoalProgress,
  DEFAULT_DAILY_GOAL_XP,
  goalXp,
  levelProgress,
  titleForLevel,
  xpRules,
  type DailyGoalProgress,
  type LevelProgress,
} from './logic';
import { awardXp, refreshStreak, type AwardResult } from './repo';
import { calculateStreak, type StreakResult } from './streak';

const log = createLogger('gamification');

export type XpOverview = {
  loading: boolean;
  totalXp: number;
  /** Today's XP including the goal bonus. */
  todayXp: number;
  level: LevelProgress;
  goal: DailyGoalProgress;
};

/**
 * The student's level and today's goal progress, kept up to date as XP is earned. "Today" is
 * the study day (it rolls over at 03:00).
 */
export function useXpOverview(): XpOverview {
  const db = useDatabase();
  const { profile } = useProfile();
  const ownerId = profile?.id ?? '';
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const goal = profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP;
  const day = currentStudyDay(timeZone);

  const total = useLiveQuery(
    db
      .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
      .from(xpEvents)
      .where(and(eq(xpEvents.ownerId, ownerId), isNull(xpEvents.deletedAt))),
    [ownerId],
  );
  const today = useLiveQuery(
    db
      .select({ source: xpEvents.source, sourceId: xpEvents.sourceId, amount: xpEvents.amount })
      .from(xpEvents)
      .where(
        and(eq(xpEvents.ownerId, ownerId), eq(xpEvents.studyDay, day), isNull(xpEvents.deletedAt)),
      ),
    [ownerId, day],
  );

  const totalXp = Number(total.data[0]?.total ?? 0);
  const todayEvents = today.data;
  return useMemo(
    () => ({
      loading: total.updatedAt === undefined || today.updatedAt === undefined,
      totalXp,
      todayXp: todayEvents.reduce((sum, e) => sum + e.amount, 0),
      level: levelProgress(totalXp),
      goal: dailyGoalProgress(goalXp(todayEvents), goal),
    }),
    [total.updatedAt, today.updatedAt, totalXp, todayEvents, goal],
  );
}

export type AwardInfo = { source: XpSource; sourceId?: string | null; count?: number };

/**
 * Gives XP for things the student does. A short toast appears only for the big moments (daily
 * goal reached, new level). A failure here is logged and never gets in the way of what the
 * student was doing.
 */
export function useXpActions() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id;
  const toast = useToast();

  const award = useCallback(
    async (info: AwardInfo): Promise<AwardResult | null> => {
      if (!ownerId) return null;
      try {
        const result = await awardXp(db, { ownerId, ...info });
        if (result.levelUp) {
          const title = strings.xp.titles[titleForLevel(result.levelUp.to)];
          toast.show({
            message: strings.xp.levelUpToast(result.levelUp.to, title),
            tone: 'success',
          });
        } else if (result.streakRepaired && result.streak) {
          toast.show({
            message: strings.streak.repairedToast(result.streak.current),
            tone: 'success',
          });
        } else if (result.goalReached) {
          toast.show({
            message: strings.xp.goalReachedToast(xpRules.daily_goal_bonus.amount),
            tone: 'success',
          });
        } else if (result.streakExtended && result.streak) {
          toast.show({
            message:
              result.streak.current <= 1
                ? strings.streak.startedToast
                : strings.streak.extendedToast(result.streak.current),
            tone: 'success',
          });
        }
        return result;
      } catch (error) {
        log.warn('Could not give XP', { source: info.source, error: String(error) });
        return null;
      }
    },
    [db, ownerId, toast],
  );

  return useMemo(() => ({ award }), [award]);
}

/**
 * The student's streak, worked out from their XP history and kept up to date as XP is earned.
 * Because it replays the history it is right after a day passes with no XP too, and it saves
 * the summary (`streak_state`) once when it first loads.
 */
export function useStreak(): { loading: boolean; streak: StreakResult; today: string } {
  const db = useDatabase();
  const { profile } = useProfile();
  const ownerId = profile?.id ?? '';
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const goal = profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP;
  const today = currentStudyDay(timeZone);

  const days = useLiveQuery(
    db
      .select({
        day: xpEvents.studyDay,
        total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`,
      })
      .from(xpEvents)
      .where(and(eq(xpEvents.ownerId, ownerId), isNull(xpEvents.deletedAt)))
      .groupBy(xpEvents.studyDay),
    [ownerId],
  );

  useEffect(() => {
    if (!ownerId) return;
    refreshStreak(db, ownerId).catch((error: unknown) =>
      log.warn('Could not save the streak', { error: String(error) }),
    );
  }, [db, ownerId, today]);

  const rows = days.data;
  const streak = useMemo(
    () =>
      calculateStreak({
        xpByDay: Object.fromEntries(rows.map((r) => [r.day, Number(r.total)])),
        today,
        dailyGoal: goal,
      }),
    [rows, today, goal],
  );
  return { loading: days.updatedAt === undefined, streak, today };
}

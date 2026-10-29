import { and, eq, isNull, sql } from 'drizzle-orm';

import { achievements, cards, notes, profiles, reviewLogs, xpEvents } from '@/db/schema';
import type { XpSource } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { DEFAULT_TIMEZONE, nowIso, studyDay } from '@/lib/time';

import {
  achievementProgress,
  countEarlyBirdDays,
  newlyUnlocked,
  type AchievementKey,
  type AchievementProgress,
  type AchievementStats,
} from './achievements';
import { DEFAULT_DAILY_GOAL_XP } from './logic';
import { calculateStreak } from './streak';

/** Gathers the numbers the badge rules look at. */
export async function loadAchievementStats(
  db: AppDatabase,
  ownerId: string,
  now: string = nowIso(),
): Promise<AchievementStats> {
  const [profile] = await db
    .select({ timezone: profiles.timezone, dailyGoalXp: profiles.dailyGoalXp })
    .from(profiles)
    .where(eq(profiles.id, ownerId))
    .limit(1);
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;

  const sourceCount = async (source: XpSource) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(xpEvents)
      .where(
        and(eq(xpEvents.ownerId, ownerId), eq(xpEvents.source, source), isNull(xpEvents.deletedAt)),
      );
    return Number(row?.n ?? 0);
  };

  const [cardRows, noteRows, occlusionRows, days, reviews] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(cards)
      .where(and(eq(cards.ownerId, ownerId), isNull(cards.deletedAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(notes)
      .where(and(eq(notes.ownerId, ownerId), isNull(notes.deletedAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(cards)
      .where(
        and(eq(cards.ownerId, ownerId), eq(cards.type, 'image_occlusion'), isNull(cards.deletedAt)),
      ),
    db
      .select({
        day: xpEvents.studyDay,
        total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)`,
      })
      .from(xpEvents)
      .where(and(eq(xpEvents.ownerId, ownerId), isNull(xpEvents.deletedAt)))
      .groupBy(xpEvents.studyDay),
    db
      .select({ at: reviewLogs.reviewedAt })
      .from(reviewLogs)
      .where(and(eq(reviewLogs.ownerId, ownerId), isNull(reviewLogs.deletedAt))),
  ]);

  const streak = calculateStreak({
    xpByDay: Object.fromEntries(days.map((d) => [d.day, Number(d.total)])),
    today: studyDay(now, timeZone),
    dailyGoal: profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP,
  });

  return {
    lessonsCompleted: await sourceCount('lesson_complete'),
    cardsCreated: Number(cardRows[0]?.n ?? 0),
    notesCreated: Number(noteRows[0]?.n ?? 0),
    occlusionCards: Number(occlusionRows[0]?.n ?? 0),
    longestStreak: Math.max(streak.current, streak.longest),
    earlyBirdDays: countEarlyBirdDays(
      reviews.map((r) => r.at),
      timeZone,
    ),
    perfectCheckpoints: await sourceCount('checkpoint_three_stars'),
    mockExams: await sourceCount('mock_exam'),
    acceptedReports: await sourceCount('error_report_accepted'),
  };
}

async function unlockedMap(db: AppDatabase, ownerId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ key: achievements.key, unlockedAt: achievements.unlockedAt })
    .from(achievements)
    .where(and(eq(achievements.ownerId, ownerId), isNull(achievements.deletedAt)));
  return new Map(rows.map((r) => [r.key, r.unlockedAt]));
}

/**
 * Looks at the student's numbers and saves any badge they have newly earned. Call it after
 * something that could earn one (XP awards cover almost everything). Returns the new badges.
 */
export async function checkAchievements(
  db: AppDatabase,
  ownerId: string,
  { now = nowIso() }: { now?: string } = {},
): Promise<AchievementKey[]> {
  const [stats, have] = await Promise.all([
    loadAchievementStats(db, ownerId, now),
    unlockedMap(db, ownerId),
  ]);
  const fresh = newlyUnlocked(stats, new Set(have.keys()));
  if (fresh.length === 0) return [];
  await db
    .insert(achievements)
    .values(
      fresh.map((key) => ({
        id: newId(),
        ownerId,
        key,
        unlockedAt: now,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
  return fresh;
}

export type AchievementEntry = AchievementProgress & {
  /** ISO time it was unlocked, or null while locked. */
  unlockedAt: string | null;
};

/** Every badge with its progress and unlock time, for the gallery (unlocked ones first). */
export async function getAchievementEntries(
  db: AppDatabase,
  ownerId: string,
): Promise<AchievementEntry[]> {
  const [stats, have] = await Promise.all([
    loadAchievementStats(db, ownerId),
    unlockedMap(db, ownerId),
  ]);
  const entries = achievementProgress(stats).map((p) => {
    const unlockedAt = have.get(p.key) ?? null;
    // A badge stays earned even if the numbers later drop (a card was deleted).
    return unlockedAt
      ? { ...p, met: true, fraction: 1, value: p.target, unlockedAt }
      : { ...p, unlockedAt };
  });
  return entries.sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt));
}

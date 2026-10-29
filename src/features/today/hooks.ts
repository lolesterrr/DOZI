import { and, desc, eq, isNull, max } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { decks, notes, quizzes, reviewLogs } from '@/db/schema';
import { useXpOverview, useStreak, type XpOverview } from '@/features/gamification/hooks';
import type { StreakResult } from '@/features/gamification/streak';
import { useProfile } from '@/features/profile/hooks';
import { useDueCount } from '@/features/review/hooks';
import { strings } from '@/i18n/strings';
import { DEFAULT_TIMEZONE, localHour, studyDay, systemClock } from '@/lib/time';

import { chooseGreeting, mergeRecent, type Greeting, type RecentItem } from './logic';

/** How many recent items the Today screen lists. */
export const RECENT_LIMIT = 5;

/** The newest few notes, decks and quizzes by last change, kept up to date. */
export function useRecentItems(limit = RECENT_LIMIT): RecentItem[] {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  const noteRows = useLiveQuery(
    db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
      .from(notes)
      .where(and(eq(notes.ownerId, ownerId), isNull(notes.deletedAt)))
      .orderBy(desc(notes.updatedAt))
      .limit(limit),
    [ownerId, limit],
  ).data;
  const deckRows = useLiveQuery(
    db
      .select({ id: decks.id, title: decks.title, updatedAt: decks.updatedAt })
      .from(decks)
      .where(and(eq(decks.ownerId, ownerId), isNull(decks.deletedAt)))
      .orderBy(desc(decks.updatedAt))
      .limit(limit),
    [ownerId, limit],
  ).data;
  const quizRows = useLiveQuery(
    db
      .select({ id: quizzes.id, title: quizzes.title, updatedAt: quizzes.updatedAt })
      .from(quizzes)
      .where(and(eq(quizzes.ownerId, ownerId), isNull(quizzes.deletedAt)))
      .orderBy(desc(quizzes.updatedAt))
      .limit(limit),
    [ownerId, limit],
  ).data;

  return useMemo(
    () =>
      mergeRecent(
        [
          ...noteRows.map((r) => ({
            kind: 'note' as const,
            ...r,
            title: r.title.trim() || strings.notes.untitled,
          })),
          ...deckRows.map((r) => ({ kind: 'deck' as const, ...r })),
          ...quizRows.map((r) => ({ kind: 'quiz' as const, ...r })),
        ],
        limit,
      ),
    [noteRows, deckRows, quizRows, limit],
  );
}

export type TodayData = {
  greeting: Greeting;
  level: XpOverview['level'];
  goal: XpOverview['goal'];
  streak: StreakResult;
  /** Cards waiting across every deck; null while counting. */
  due: number | null;
  deckCount: number;
  recent: RecentItem[];
};

/**
 * Everything the Today screen shows, kept up to date: the goal and level move as XP is earned,
 * the due count is redone after every answer (and when the tab comes back into view), and the
 * greeting follows the time of day.
 */
export function useToday(): TodayData {
  const db = useDatabase();
  const { profile } = useProfile();
  const ownerId = profile?.id ?? '';
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const overview = useXpOverview();
  const { streak } = useStreak();
  const recent = useRecentItems();

  // The newest review answer: when it changes a card was answered, so the due count is redone.
  const lastAnswer = useLiveQuery(
    db
      .select({ at: max(reviewLogs.reviewedAt) })
      .from(reviewLogs)
      .where(and(eq(reviewLogs.ownerId, ownerId), isNull(reviewLogs.deletedAt))),
    [ownerId],
  ).data[0]?.at;
  const deckList = useLiveQuery(
    db
      .select({ id: decks.id, updatedAt: decks.updatedAt })
      .from(decks)
      .where(and(eq(decks.ownerId, ownerId), isNull(decks.deletedAt))),
    [ownerId],
  ).data;
  const due = useDueCount(
    'all',
    `${lastAnswer ?? ''}|${deckList.map((d) => d.updatedAt).join(',')}`,
  );

  // The greeting is worked out again each time the tab comes into view.
  const [now, setNow] = useState(() => systemClock());
  useFocusEffect(
    useCallback(() => {
      setNow(systemClock());
    }, []),
  );
  const { current: streakDays, todayCounted } = streak;
  const greeting = useMemo(
    () =>
      chooseGreeting({
        hour: localHour(now, timeZone),
        day: studyDay(now, timeZone),
        streakDays,
        todayCounted,
        goalMet: overview.goal.met,
      }),
    [now, timeZone, streakDays, todayCounted, overview.goal.met],
  );

  return {
    greeting,
    level: overview.level,
    goal: overview.goal,
    streak,
    due,
    deckCount: deckList.length,
    recent,
  };
}

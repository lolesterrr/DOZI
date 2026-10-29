import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';

import {
  cardInstances,
  cardState,
  cards,
  decks,
  profiles,
  questionResponses,
  questions,
  quizAttempts,
  reviewLogs,
  xpEvents,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { DEFAULT_DAILY_GOAL_XP } from '@/features/gamification/logic';
import { DEFAULT_TIMEZONE, nowIso, studyDay } from '@/lib/time';

import type { StatsData } from './logic';

/**
 * Reads the student's history. It loads every review answer (a few bytes each) rather than
 * summing in SQL, because the study day depends on the time zone and the 03:00 rollover.
 */
export async function loadStatsData(
  db: AppDatabase,
  ownerId: string,
  now: string = nowIso(),
): Promise<StatsData> {
  const [profile] = await db
    .select({ timezone: profiles.timezone, dailyGoalXp: profiles.dailyGoalXp })
    .from(profiles)
    .where(eq(profiles.id, ownerId))
    .limit(1);
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;

  const [xpRows, reviewRows, dueRows, quizRows, deckRows, cardCounts] = await Promise.all([
    db
      .select({ day: xpEvents.studyDay, total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
      .from(xpEvents)
      .where(and(eq(xpEvents.ownerId, ownerId), isNull(xpEvents.deletedAt)))
      .groupBy(xpEvents.studyDay),
    db
      .select({
        at: reviewLogs.reviewedAt,
        rating: reviewLogs.rating,
        durationMs: reviewLogs.reviewDurationMs,
        deckId: cards.deckId,
      })
      .from(reviewLogs)
      .innerJoin(cardInstances, eq(cardInstances.id, reviewLogs.cardInstanceId))
      .innerJoin(cards, eq(cards.id, cardInstances.cardId))
      .where(and(eq(reviewLogs.ownerId, ownerId), isNull(reviewLogs.deletedAt))),
    db
      .select({ deckId: cards.deckId, due: cardState.due })
      .from(cardState)
      .innerJoin(cardInstances, eq(cardInstances.id, cardState.cardInstanceId))
      .innerJoin(cards, eq(cards.id, cardInstances.cardId))
      .where(
        and(
          eq(cardState.ownerId, ownerId),
          isNull(cardState.deletedAt),
          isNull(cardInstances.deletedAt),
          isNull(cards.deletedAt),
          eq(cards.suspended, false),
          ne(cardState.state, 'new'),
        ),
      ),
    db
      .select({
        type: questions.type,
        score: questionResponses.score,
        maxScore: questionResponses.maxScore,
        timeMs: questionResponses.timeMs,
      })
      .from(questionResponses)
      .innerJoin(quizAttempts, eq(quizAttempts.id, questionResponses.attemptId))
      .innerJoin(questions, eq(questions.id, questionResponses.questionId))
      .where(
        and(
          eq(questionResponses.ownerId, ownerId),
          isNull(questionResponses.deletedAt),
          isNotNull(questionResponses.responseJson),
          isNotNull(quizAttempts.finishedAt),
          isNull(quizAttempts.deletedAt),
        ),
      ),
    db
      .select({ id: decks.id, title: decks.title })
      .from(decks)
      .where(and(eq(decks.ownerId, ownerId), isNull(decks.deletedAt))),
    db
      .select({ deckId: cards.deckId, n: sql<number>`count(*)` })
      .from(cards)
      .where(and(eq(cards.ownerId, ownerId), isNull(cards.deletedAt)))
      .groupBy(cards.deckId),
  ]);

  const counts = new Map(cardCounts.map((c) => [c.deckId, Number(c.n)]));
  return {
    now,
    today: studyDay(now, timeZone),
    timeZone,
    goal: profile?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP,
    xpByDay: Object.fromEntries(xpRows.map((r) => [r.day, Number(r.total)])),
    reviews: reviewRows,
    due: dueRows,
    quiz: quizRows,
    decks: deckRows.map((d) => ({ id: d.id, title: d.title, cards: counts.get(d.id) ?? 0 })),
  };
}

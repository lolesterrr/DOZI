import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import {
  questionResponses,
  questions,
  quizAttempts,
  quizQuestions,
  type Question,
} from '@/db/schema';
import { inSlices } from '@/db/slices';
import type { AppDatabase } from '@/db/types';
import { quizListQuery, wrongQuestionIds } from '@/features/quizzes/repo';

import {
  MISTAKES_DRILL_SIZE,
  mistakeQuestionIds,
  pickRandom,
  QUICK_QUIZ_SIZE,
  recentQuizzes,
  RECENT_QUIZ_COUNT,
  type Drill,
  type RecentQuiz,
} from './logic';

// Reads for the Practice tab and the drills it starts (PRODUCT_SPEC §5.2). Nothing here writes:
// a drill's attempt is saved by the quiz player like any other attempt.

/** How many recent attempts "Recent quizzes" looks through. */
const RECENT_ATTEMPTS_LOOKED_AT = 200;

/** Live questions of an owner, by id, in the order of `ids`. Missing or deleted ones are left out. */
async function questionsByIds(
  db: AppDatabase,
  ownerId: string,
  ids: readonly string[],
): Promise<Question[]> {
  if (ids.length === 0) return [];
  const rows: Question[] = [];
  for (const slice of inSlices(ids)) {
    rows.push(
      ...(await db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.ownerId, ownerId),
            isNull(questions.deletedAt),
            inArray(questions.id, slice),
          ),
        )),
    );
  }
  const byId = new Map(rows.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
}

/**
 * The questions a quick quiz can pick from: every live question in the bank, or only those in
 * the given quizzes.
 */
export async function quickQuizPool(
  db: AppDatabase,
  ownerId: string,
  quizIds: readonly string[] = [],
): Promise<Question[]> {
  if (quizIds.length === 0) {
    return db
      .select()
      .from(questions)
      .where(and(eq(questions.ownerId, ownerId), isNull(questions.deletedAt)));
  }
  const linked = new Set<string>();
  for (const slice of inSlices(quizIds)) {
    const links = await db
      .select({ questionId: quizQuestions.questionId })
      .from(quizQuestions)
      .where(and(inArray(quizQuestions.quizId, slice), isNull(quizQuestions.deletedAt)));
    for (const link of links) linked.add(link.questionId);
  }
  return questionsByIds(db, ownerId, [...linked]);
}

/** "Fix my mistakes": the live questions whose most recent answer wasn't fully right. */
export async function listMistakeIds(db: AppDatabase, ownerId: string): Promise<string[]> {
  const rows = await db
    .select({
      questionId: questionResponses.questionId,
      isCorrect: questionResponses.isCorrect,
      finishedAt: quizAttempts.finishedAt,
    })
    .from(questionResponses)
    .innerJoin(quizAttempts, eq(quizAttempts.id, questionResponses.attemptId))
    .innerJoin(questions, eq(questions.id, questionResponses.questionId))
    .where(
      and(
        eq(questionResponses.ownerId, ownerId),
        isNull(questionResponses.deletedAt),
        // A question skipped when leaving early isn't a mistake.
        isNotNull(questionResponses.responseJson),
        isNotNull(quizAttempts.finishedAt),
        isNull(quizAttempts.deletedAt),
        isNull(questions.deletedAt),
      ),
    );
  return mistakeQuestionIds(rows.map((row) => ({ ...row, finishedAt: row.finishedAt as string })));
}

/**
 * The questions a drill asks, before shuffling. A retry (`retryOf`) asks the ones that attempt
 * didn't get fully right.
 */
export async function loadDrillQuestions(
  db: AppDatabase,
  ownerId: string,
  drill: Drill,
  retryOf: string | null,
  random: () => number = Math.random,
): Promise<Question[]> {
  if (retryOf) return questionsByIds(db, ownerId, await wrongQuestionIds(db, retryOf));
  if (drill.kind === 'quick') {
    return pickRandom(await quickQuizPool(db, ownerId, drill.quizIds), QUICK_QUIZ_SIZE, random);
  }
  const ids = await listMistakeIds(db, ownerId);
  return questionsByIds(db, ownerId, ids.slice(0, MISTAKES_DRILL_SIZE));
}

export type PracticeSummary = {
  /** Live questions in the bank. */
  questionCount: number;
  /** Questions waiting in "Fix my mistakes". */
  mistakeCount: number;
  recent: RecentQuiz[];
  /** Quizzes with questions, A–Z, for choosing what a quick quiz picks from. */
  quizzes: { id: string; title: string; questionCount: number }[];
};

/** Everything the Practice tab shows apart from the due cards. */
export async function loadPracticeSummary(
  db: AppDatabase,
  ownerId: string,
): Promise<PracticeSummary> {
  const [bank, mistakes, quizList, attempts] = await Promise.all([
    db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.ownerId, ownerId), isNull(questions.deletedAt))),
    listMistakeIds(db, ownerId),
    quizListQuery(db, ownerId),
    db
      .select({
        quizId: quizAttempts.quizId,
        finishedAt: quizAttempts.finishedAt,
        score: quizAttempts.score,
        maxScore: quizAttempts.maxScore,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.ownerId, ownerId),
          isNull(quizAttempts.deletedAt),
          isNotNull(quizAttempts.quizId),
          isNotNull(quizAttempts.finishedAt),
        ),
      )
      .orderBy(desc(quizAttempts.finishedAt))
      .limit(RECENT_ATTEMPTS_LOOKED_AT),
  ]);
  return {
    questionCount: bank.length,
    mistakeCount: mistakes.length,
    recent: recentQuizzes(quizList, attempts, RECENT_QUIZ_COUNT),
    quizzes: quizList
      .filter((quiz) => quiz.questionCount > 0)
      .map((quiz) => ({ id: quiz.id, title: quiz.title, questionCount: quiz.questionCount }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}

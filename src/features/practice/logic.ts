import { shuffle } from '@/features/review/logic';
import { attemptPercent } from '@/features/quizzes/logic';
import { DEFAULT_QUIZ_SETTINGS, type QuizSettings } from '@/features/quizzes/types';

// The Practice tab (PRODUCT_SPEC §5.2): quick quizzes from the question bank, "Fix my mistakes"
// and the recent quizzes list. Due cards by deck are worked out in `review/logic.ts`.

/** How many questions a quick quiz asks. */
export const QUICK_QUIZ_SIZE = 10;
/** The most questions one "Fix my mistakes" round asks. */
export const MISTAKES_DRILL_SIZE = 15;
/** How many quizzes "Recent quizzes" lists. */
export const RECENT_QUIZ_COUNT = 4;

export const drillKinds = ['quick', 'mistakes'] as const;
export type DrillKind = (typeof drillKinds)[number];

/**
 * A quiz made up on the spot, not saved in the Library. A quick quiz picks random questions
 * from the whole bank, or only from the quizzes in `quizIds`. "Fix my mistakes" asks the
 * questions whose last answer wasn't fully right.
 */
export type Drill = { kind: 'quick'; quizIds: string[] } | { kind: 'mistakes' };

/** Drills are always practice mode, in a fresh order each time. */
export const DRILL_SETTINGS: QuizSettings = {
  ...DEFAULT_QUIZ_SETTINGS,
  mode: 'practice',
  shuffleQuestions: true,
  shuffleOptions: true,
};

function isDrillKind(value: string): value is DrillKind {
  return (drillKinds as readonly string[]).includes(value);
}

function cleanIds(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set(text.split(',').map((id) => id.trim()))].filter((id) => id !== '');
}

/** Reads `/drill/<kind>?from=<quiz id>,<quiz id>`. Null for an unknown kind. */
export function parseDrillRoute(
  kind: string | undefined,
  from: string | undefined | null,
): Drill | null {
  if (!kind || !isDrillKind(kind)) return null;
  return kind === 'quick' ? { kind, quizIds: cleanIds(from) } : { kind };
}

/**
 * How a drill is saved in `quiz_attempts.context_id`, so "Take it again" on the results screen
 * starts the same kind of drill: `quick`, `quick:<quiz id>,<quiz id>` or `mistakes`.
 */
export function drillContextId(drill: Drill): string {
  if (drill.kind === 'quick' && drill.quizIds.length > 0) {
    return `quick:${drill.quizIds.join(',')}`;
  }
  return drill.kind;
}

/** Reads `drillContextId` back. Null for anything else. */
export function parseDrillContext(contextId: string | null | undefined): Drill | null {
  if (!contextId) return null;
  const [kind, rest] = contextId.split(':', 2) as [string, string | undefined];
  return parseDrillRoute(kind, rest);
}

/** Up to `count` items in a random order. */
export function pickRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

/** One answered question in a finished attempt. */
export type ResponseHistoryRow = {
  questionId: string;
  isCorrect: boolean;
  /** When the attempt was finished (ISO). */
  finishedAt: string;
};

/**
 * "Fix my mistakes": the questions whose most recent answer wasn't fully right, most recent
 * mistake first. Getting a question right later (in any quiz) takes it off the list.
 */
export function mistakeQuestionIds(rows: readonly ResponseHistoryRow[]): string[] {
  const latest = new Map<string, ResponseHistoryRow>();
  for (const row of rows) {
    const seen = latest.get(row.questionId);
    if (!seen || row.finishedAt >= seen.finishedAt) latest.set(row.questionId, row);
  }
  return [...latest.values()]
    .filter((row) => !row.isCorrect)
    .sort((a, b) =>
      a.finishedAt === b.finishedAt
        ? a.questionId.localeCompare(b.questionId)
        : b.finishedAt.localeCompare(a.finishedAt),
    )
    .map((row) => row.questionId);
}

export type QuizListRow = {
  id: string;
  title: string;
  questionCount: number;
  updatedAt: string;
};

export type AttemptListRow = {
  quizId: string | null;
  finishedAt: string | null;
  score: number;
  maxScore: number;
};

export type RecentQuiz = {
  quizId: string;
  title: string;
  questionCount: number;
  /** The last attempt's score, or null if the quiz hasn't been taken. */
  lastPercent: number | null;
  lastTakenAt: string | null;
};

/**
 * "Recent quizzes": the quizzes taken most recently, then (to fill the list) the quizzes edited
 * most recently that haven't been taken yet. Quizzes with no questions are left out.
 */
export function recentQuizzes(
  quizList: readonly QuizListRow[],
  attempts: readonly AttemptListRow[],
  limit: number = RECENT_QUIZ_COUNT,
): RecentQuiz[] {
  const last = new Map<string, AttemptListRow>();
  for (const attempt of attempts) {
    if (!attempt.quizId || !attempt.finishedAt) continue;
    const seen = last.get(attempt.quizId);
    if (!seen || attempt.finishedAt > (seen.finishedAt ?? '')) last.set(attempt.quizId, attempt);
  }
  const playable = quizList.filter((quiz) => quiz.questionCount > 0);
  const taken = playable
    .filter((quiz) => last.has(quiz.id))
    .map((quiz) => ({ quiz, attempt: last.get(quiz.id) as AttemptListRow }))
    .sort((a, b) => (b.attempt.finishedAt ?? '').localeCompare(a.attempt.finishedAt ?? ''));
  const untaken = playable
    .filter((quiz) => !last.has(quiz.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [
    ...taken.map(({ quiz, attempt }) => ({
      quizId: quiz.id,
      title: quiz.title,
      questionCount: quiz.questionCount,
      lastPercent: attemptPercent(attempt),
      lastTakenAt: attempt.finishedAt,
    })),
    ...untaken.map((quiz) => ({
      quizId: quiz.id,
      title: quiz.title,
      questionCount: quiz.questionCount,
      lastPercent: null,
      lastTakenAt: null,
    })),
  ].slice(0, Math.max(0, limit));
}

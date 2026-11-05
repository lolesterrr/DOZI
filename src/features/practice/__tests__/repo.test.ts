import type { AppDatabase } from '@/db/types';
import {
  createQuestion,
  createQuestionInQuiz,
  createQuiz,
  deleteQuestion,
  saveAttempt,
} from '@/features/quizzes/repo';
import { DEFAULT_QUIZ_SETTINGS } from '@/features/quizzes/types';
import { createTestDatabase } from '@/test-utils/db';
import { sampleQuestions } from '@/test-utils/sampleQuestions';

import { MISTAKES_DRILL_SIZE, QUICK_QUIZ_SIZE } from '../logic';
import { listMistakeIds, loadDrillQuestions, loadPracticeSummary, quickQuizPool } from '../repo';

// The Practice tab's reads on an in-memory database. SAMPLE content only — no drug facts.
const owner = 'owner-1';
const t = (minute: number) => new Date(Date.UTC(2026, 10, 5, 10, minute)).toISOString();

/** Saves a finished attempt where each listed question was right (true), wrong or skipped (null). */
async function attempt(
  db: AppDatabase,
  quizId: string | null,
  minute: number,
  answers: Record<string, boolean | null>,
) {
  const responses = Object.entries(answers).map(([questionId, right], position) => ({
    questionId,
    position,
    responseJson: right === null ? null : '{"choice":"o1"}',
    score: right ? 1 : 0,
    maxScore: 1,
    isCorrect: right === true,
    timeMs: 1000,
    flagged: false,
  }));
  return saveAttempt(
    db,
    {
      ownerId: owner,
      quizId,
      mode: 'practice',
      settings: DEFAULT_QUIZ_SETTINGS,
      startedAt: t(minute),
      result: {
        responses,
        score: responses.filter((r) => r.isCorrect).length,
        maxScore: responses.length,
      },
      ...(quizId ? {} : { drillContextId: 'mistakes' }),
    },
    { now: () => t(minute) },
  );
}

async function setUp() {
  const db = createTestDatabase();
  const quizA = await createQuiz(db, { ownerId: owner, title: 'SAMPLE A' });
  const quizB = await createQuiz(db, { ownerId: owner, title: 'SAMPLE B' });
  const inA = [];
  for (let i = 0; i < 3; i++) {
    inA.push(
      await createQuestionInQuiz(db, {
        ownerId: owner,
        quizId: quizA.id,
        draft: sampleQuestions.sba,
      }),
    );
  }
  const inB = await createQuestionInQuiz(db, {
    ownerId: owner,
    quizId: quizB.id,
    draft: sampleQuestions.mtf,
  });
  const loose = await createQuestion(db, { ownerId: owner, draft: sampleQuestions.saq });
  // Someone else's question never shows up.
  await createQuestion(db, { ownerId: 'owner-2', draft: sampleQuestions.sba });
  return { db, quizA, quizB, inA: inA.map((q) => q.id), inB: inB.id, loose: loose.id };
}

describe('quick quiz', () => {
  it('picks from the whole bank, or only from the chosen quizzes', async () => {
    const { db, quizA, quizB, inA, inB, loose } = await setUp();
    expect((await quickQuizPool(db, owner)).map((q) => q.id).sort()).toEqual(
      [...inA, inB, loose].sort(),
    );
    expect((await quickQuizPool(db, owner, [quizB.id])).map((q) => q.id)).toEqual([inB]);
    expect((await quickQuizPool(db, owner, [quizA.id, quizB.id])).length).toBe(4);
  });

  it('asks at most QUICK_QUIZ_SIZE questions', async () => {
    const { db } = await setUp();
    for (let i = 0; i < QUICK_QUIZ_SIZE + 3; i++) {
      await createQuestion(db, { ownerId: owner, draft: sampleQuestions.sba });
    }
    const picked = await loadDrillQuestions(db, owner, { kind: 'quick', quizIds: [] }, null);
    expect(picked).toHaveLength(QUICK_QUIZ_SIZE);
    expect(new Set(picked.map((q) => q.id)).size).toBe(QUICK_QUIZ_SIZE);
  });
});

describe('fix my mistakes', () => {
  it('lists questions last answered wrong, skips unanswered and deleted ones', async () => {
    const { db, quizA, inA } = await setUp();
    const [q1, q2, q3] = inA;
    await attempt(db, quizA.id, 1, { [q1]: false, [q2]: false, [q3]: null });
    // q1 is fixed in a later "Fix my mistakes" round.
    await attempt(db, null, 2, { [q1]: true });
    expect(await listMistakeIds(db, owner)).toEqual([q2]);

    await deleteQuestion(db, q2);
    expect(await listMistakeIds(db, owner)).toEqual([]);
  });

  it('asks the mistakes (at most MISTAKES_DRILL_SIZE), and a retry asks what that round missed', async () => {
    const { db, quizA, inA } = await setUp();
    const [q1, q2] = inA;
    await attempt(db, quizA.id, 1, { [q1]: false, [q2]: false });
    const asked = await loadDrillQuestions(db, owner, { kind: 'mistakes' }, null);
    expect(asked.map((q) => q.id).sort()).toEqual([q1, q2].sort());
    expect(MISTAKES_DRILL_SIZE).toBeGreaterThan(2);

    const round = await attempt(db, null, 2, { [q1]: true, [q2]: false });
    const retry = await loadDrillQuestions(db, owner, { kind: 'mistakes' }, round.id);
    expect(retry.map((q) => q.id)).toEqual([q2]);
  });
});

describe('loadPracticeSummary', () => {
  it('counts the bank and mistakes and lists recent quizzes', async () => {
    const { db, quizA, quizB, inA } = await setUp();
    await createQuiz(db, { ownerId: owner, title: 'SAMPLE empty' });
    await attempt(db, quizA.id, 1, { [inA[0]]: true, [inA[1]]: false });
    const summary = await loadPracticeSummary(db, owner);
    expect(summary.questionCount).toBe(5);
    expect(summary.mistakeCount).toBe(1);
    expect(summary.recent.map((q) => [q.title, q.lastPercent])).toEqual([
      ['SAMPLE A', 50],
      ['SAMPLE B', null],
    ]);
    expect(summary.quizzes.map((q) => q.id)).toEqual([quizA.id, quizB.id]);
  });
});

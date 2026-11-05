import { countDueByDeck, decksWithDue } from '@/features/review/logic';

import {
  drillContextId,
  mistakeQuestionIds,
  parseDrillContext,
  parseDrillRoute,
  pickRandom,
  recentQuizzes,
  type Drill,
} from '../logic';

// SAMPLE data for tests only.
const t = (minute: number) => new Date(Date.UTC(2026, 10, 5, 10, minute)).toISOString();

describe('drill routes and saved context', () => {
  it('reads the route, ignoring blanks and repeats in `from`', () => {
    expect(parseDrillRoute('quick', undefined)).toEqual({ kind: 'quick', quizIds: [] });
    expect(parseDrillRoute('quick', 'q1, q2,,q1')).toEqual({
      kind: 'quick',
      quizIds: ['q1', 'q2'],
    });
    expect(parseDrillRoute('mistakes', 'q1')).toEqual({ kind: 'mistakes' });
    expect(parseDrillRoute('weak', undefined)).toBeNull();
    expect(parseDrillRoute(undefined, undefined)).toBeNull();
  });

  it.each<Drill>([
    { kind: 'quick', quizIds: [] },
    { kind: 'quick', quizIds: ['q1', 'q2'] },
    { kind: 'mistakes' },
  ])('saves and reads back %j', (drill) => {
    expect(parseDrillContext(drillContextId(drill))).toEqual(drill);
  });

  it('reads nothing from a missing or unknown context', () => {
    expect(parseDrillContext(null)).toBeNull();
    expect(parseDrillContext('quiz-id-123')).toBeNull();
  });
});

describe('pickRandom', () => {
  it('takes at most `count` different items', () => {
    const picked = pickRandom([1, 2, 3, 4, 5], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(pickRandom([1, 2], 10).sort()).toEqual([1, 2]);
    expect(pickRandom([1, 2], 0)).toEqual([]);
  });
});

describe('mistakeQuestionIds', () => {
  it('keeps the questions whose latest answer was wrong, latest mistake first', () => {
    expect(
      mistakeQuestionIds([
        // a: wrong, then right later → fixed.
        { questionId: 'a', isCorrect: false, finishedAt: t(1) },
        { questionId: 'a', isCorrect: true, finishedAt: t(5) },
        // b: right, then wrong later → a mistake.
        { questionId: 'b', isCorrect: true, finishedAt: t(1) },
        { questionId: 'b', isCorrect: false, finishedAt: t(3) },
        // c: wrong once, most recently.
        { questionId: 'c', isCorrect: false, finishedAt: t(4) },
        // d: only ever right.
        { questionId: 'd', isCorrect: true, finishedAt: t(2) },
      ]),
    ).toEqual(['c', 'b']);
  });

  it('is empty with no history', () => {
    expect(mistakeQuestionIds([])).toEqual([]);
  });
});

describe('recentQuizzes', () => {
  const quizzes = [
    { id: 'q1', title: 'SAMPLE one', questionCount: 3, updatedAt: t(1) },
    { id: 'q2', title: 'SAMPLE two', questionCount: 5, updatedAt: t(2) },
    { id: 'q3', title: 'SAMPLE three', questionCount: 2, updatedAt: t(9) },
    { id: 'q4', title: 'SAMPLE empty', questionCount: 0, updatedAt: t(10) },
  ];

  it('lists taken quizzes by their last attempt, then untaken ones by last edit', () => {
    const list = recentQuizzes(quizzes, [
      { quizId: 'q1', finishedAt: t(3), score: 1, maxScore: 4 },
      { quizId: 'q2', finishedAt: t(4), score: 5, maxScore: 5 },
      { quizId: 'q1', finishedAt: t(6), score: 3, maxScore: 4 },
      // Drills have no quiz; unfinished attempts don't count.
      { quizId: null, finishedAt: t(7), score: 0, maxScore: 1 },
      { quizId: 'q3', finishedAt: null, score: 0, maxScore: 1 },
    ]);
    expect(list.map((q) => [q.quizId, q.lastPercent])).toEqual([
      ['q1', 75],
      ['q2', 100],
      ['q3', null],
    ]);
  });

  it('stops at the limit and leaves out quizzes with no questions', () => {
    expect(recentQuizzes(quizzes, [], 2).map((q) => q.quizId)).toEqual(['q3', 'q2']);
  });
});

describe('due cards by deck', () => {
  it('counts each deck and lists the decks with cards due, most first', () => {
    const counts = countDueByDeck([
      { deckId: 'd1' },
      { deckId: 'd2' },
      { deckId: 'd2' },
      { deckId: 'd3' },
    ]);
    expect(counts.get('d2')).toBe(2);
    expect(
      decksWithDue(
        [
          { id: 'd1', title: 'SAMPLE B' },
          { id: 'd2', title: 'SAMPLE C' },
          { id: 'd3', title: 'SAMPLE A' },
          { id: 'd4', title: 'SAMPLE none due' },
        ],
        counts,
      ),
    ).toEqual([
      { deckId: 'd2', title: 'SAMPLE C', due: 2 },
      { deckId: 'd3', title: 'SAMPLE A', due: 1 },
      { deckId: 'd1', title: 'SAMPLE B', due: 1 },
    ]);
  });
});

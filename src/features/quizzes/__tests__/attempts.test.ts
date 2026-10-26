import { createDeck, listCards } from '@/features/decks/repo';
import { createTestDatabase } from '@/test-utils/db';
import { sampleQuestions } from '@/test-utils/sampleQuestions';

import {
  buildAttemptResult,
  buildPlayItems,
  questionToCard,
  questionToDraft,
  summariseAttempt,
  type QuestionDraft,
} from '../logic';
import {
  addCardsToDeck,
  createQuestionInQuiz,
  createQuiz,
  deleteQuestion,
  getAttempt,
  listAttemptResponses,
  listQuizAttempts,
  listQuizQuestions,
  saveAttempt,
  wrongQuestionIds,
} from '../repo';
import { DEFAULT_QUIZ_SETTINGS, parseQuizSettings, parseResponse } from '../types';

// SAMPLE content for tests only — made-up words, no drug facts.
const owner = 'owner-1';
const minutes = (n: number) => new Date(Date.UTC(2026, 9, 25, 10, n)).toISOString();
let ids = 0;
const newId = () => `id-${++ids}`;
const at = (n: number) => ({ newId, now: () => minutes(n) });

async function quizWithEveryType() {
  const db = createTestDatabase();
  const quiz = await createQuiz(db, { ownerId: owner, title: 'SAMPLE quiz' }, at(0));
  for (const draft of Object.values(sampleQuestions)) {
    await createQuestionInQuiz(db, { ownerId: owner, quizId: quiz.id, draft }, at(0));
  }
  const rows = await listQuizQuestions(db, quiz.id);
  const items = buildPlayItems(
    rows.map((row) => ({
      questionId: row.question.id,
      points: row.points,
      question: questionToDraft(row.question) as QuestionDraft,
    })),
    DEFAULT_QUIZ_SETTINGS,
  );
  return { db, quiz, items };
}

describe('attempts', () => {
  it('saves a finished attempt with every response, and reads it back in order', async () => {
    const { db, quiz, items } = await quizWithEveryType();
    const byType = Object.fromEntries(items.map((i) => [i.question.type, i.questionId]));
    const responses = {
      // Right: SBA, MTF, fill-in. Wrong or partial: multiple response, matching. SAQ: 1 of 2.
      [byType.sba]: { choice: 'o1' },
      [byType.mtf]: { answers: { s1: true, s2: false } },
      [byType.fill_blank]: { blanks: { '1': 'WUGS', '2': 'blick' } },
      [byType.multiple_response]: { choices: ['o1'] },
      [byType.matching]: { matches: { p1: 'SAMPLE right B' } },
      [byType.saq]: { text: 'SAMPLE written', ticked: ['m1'], marked: true },
    };
    const result = buildAttemptResult(items, responses, DEFAULT_QUIZ_SETTINGS, {
      flagged: { [byType.matching]: true },
    });
    const attempt = await saveAttempt(
      db,
      {
        ownerId: owner,
        quizId: quiz.id,
        mode: 'exam',
        settings: { ...DEFAULT_QUIZ_SETTINGS, mode: 'exam', passMark: 60 },
        startedAt: minutes(1),
        result,
      },
      at(6),
    );

    expect(attempt).toMatchObject({
      quizId: quiz.id,
      context: 'quiz',
      mode: 'exam',
      startedAt: minutes(1),
      finishedAt: minutes(6),
      score: 1 + 2 + 2 + 1 + 0 + 1,
      maxScore: 1 + 2 + 2 + 2 + 2 + 2,
      dirty: true,
    });
    expect(parseQuizSettings(attempt.settingsJson).passMark).toBe(60);

    const rows = await listAttemptResponses(db, attempt.id);
    expect(rows.map((r) => r.question.id)).toEqual(items.map((i) => i.questionId));
    const matching = rows.find((r) => r.question.type === 'matching');
    expect(matching?.response).toMatchObject({ isCorrect: false, flagged: true, score: 0 });
    expect(parseResponse('matching', matching?.response.responseJson)).toEqual({
      matches: { p1: 'SAMPLE right B' },
    });

    const summary = summariseAttempt(
      attempt,
      rows.map((r) => r.response),
      60,
    );
    expect(summary).toMatchObject({ percent: 64, passed: true, correct: 3, wrong: 3 });
    expect(summary.timeMs).toBe(5 * 60_000);

    expect(await wrongQuestionIds(db, attempt.id)).toEqual([
      byType.multiple_response,
      byType.matching,
      byType.saq,
    ]);
  });

  it('lists a quiz’s attempts newest first and keeps results of deleted questions', async () => {
    const { db, quiz, items } = await quizWithEveryType();
    const save = (n: number) =>
      saveAttempt(
        db,
        {
          ownerId: owner,
          quizId: quiz.id,
          mode: 'practice',
          settings: DEFAULT_QUIZ_SETTINGS,
          startedAt: minutes(n),
          result: buildAttemptResult(items, {}, DEFAULT_QUIZ_SETTINGS),
        },
        at(n + 1),
      );
    const first = await save(1);
    const second = await save(10);
    expect((await listQuizAttempts(db, quiz.id)).map((a) => a.id)).toEqual([second.id, first.id]);

    await deleteQuestion(db, items[0].questionId, at(20));
    const rows = await listAttemptResponses(db, first.id);
    expect(rows).toHaveLength(items.length);
    expect(rows[0].question.deletedAt).toBe(minutes(20));
    expect((await getAttempt(db, first.id))?.score).toBe(0);
  });

  it('adds wrong questions to a deck as flashcards', async () => {
    const { db, items } = await quizWithEveryType();
    const deck = await createDeck(db, { ownerId: owner, title: 'SAMPLE deck' }, at(0));
    const labels = { true: 'T', false: 'F', chooseAll: 'All', modelAnswer: 'Model' };
    const added = await addCardsToDeck(
      db,
      {
        ownerId: owner,
        deckId: deck.id,
        cards: items.map((i) => questionToCard(i.question, labels)),
      },
      at(2),
    );
    expect(added).toBe(items.length);
    const cards = await listCards(db, deck.id);
    expect(cards.map((c) => c.type).sort()).toEqual([
      'basic',
      'basic',
      'basic',
      'basic',
      'basic',
      'cloze',
    ]);
  });
});

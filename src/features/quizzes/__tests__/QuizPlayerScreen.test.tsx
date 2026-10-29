import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { xpEvents } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';
import { sampleQuestions } from '@/test-utils/sampleQuestions';

import { QuizPlayerScreen } from '../components/QuizPlayerScreen';
import { buildAttemptResult, buildPlayItems, questionToDraft, type QuestionDraft } from '../logic';
import {
  createQuestionInQuiz,
  createQuiz,
  listAttemptResponses,
  listQuizAttempts,
  listQuizQuestions,
  saveAttempt,
  updateQuizSettings,
} from '../repo';
import { DEFAULT_QUIZ_SETTINGS, parseResponse } from '../types';

// The quiz player end to end against a real (in-memory) database, in both modes.
// SAMPLE content for tests only — made-up words, no drug facts.
const p = strings.quizzes.play;
const a = strings.quizzes.answer;
const owner = 'owner-1';

let mockDb: AppDatabase;
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'owner-1', timezone: 'Africa/Kampala' } }),
}));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

let quizId: string;

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = createLiveTestDatabase();
  const quiz = await createQuiz(mockDb, { ownerId: owner, title: 'SAMPLE quiz' });
  quizId = quiz.id;
  for (const type of ['sba', 'mtf', 'fill_blank', 'saq'] as const) {
    await createQuestionInQuiz(mockDb, { ownerId: owner, quizId, draft: sampleQuestions[type] });
  }
});

async function start(retryOf: string | null = null) {
  await renderWithProviders(<QuizPlayerScreen quizId={quizId} retryOf={retryOf} />);
  await fireEvent.press(await screen.findByRole('button', { name: p.begin }));
}

async function savedAttempt() {
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  const [attempt] = await listQuizAttempts(mockDb, quizId);
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/quiz/attempt/[attemptId]',
    params: { attemptId: attempt.id },
  });
  return { attempt, responses: await listAttemptResponses(mockDb, attempt.id) };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('quiz player: practice mode', () => {
  it('shows the intro, then checks each answer with feedback and saves the attempt', async () => {
    await renderWithProviders(<QuizPlayerScreen quizId={quizId} retryOf={null} />);
    expect(await screen.findByText(p.introPractice)).toBeOnTheScreen();
    expect(screen.getByText(`${p.introQuestions(4)} · ${p.introPoints('7')}`)).toBeOnTheScreen();
    await press(p.begin);

    // SBA: the right option, then feedback with the reason.
    expect(screen.getByText(p.progress(1, 4), { exact: false })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: a.option('A', 'SAMPLE alpha') }));
    await press(p.check);
    expect(screen.getByText(a.verdicts.right)).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE because')).toBeOnTheScreen();
    await press(p.next);

    // MTF: one right, one wrong.
    await fireEvent.press(screen.getByRole('radio', { name: a.markTrue(1) }));
    await fireEvent.press(screen.getByRole('radio', { name: a.markTrue(2) }));
    await press(p.check);
    expect(screen.getByText(a.verdicts.partial)).toBeOnTheScreen();
    expect(
      screen.getByText(a.statementWrong(strings.questions.true, strings.questions.false)),
    ).toBeOnTheScreen();
    await press(p.next);

    // Fill in the blank: capitals don't matter.
    const [first, second] = screen.getAllByPlaceholderText(a.blankPlaceholder);
    await fireEvent.changeText(first, 'WUG');
    await fireEvent.changeText(second, 'blick');
    await press(p.check);
    expect(screen.getByText(a.verdicts.right)).toBeOnTheScreen();
    await press(p.next);

    // SAQ: write, then tick the points covered.
    await fireEvent.changeText(screen.getByPlaceholderText(a.saqPlaceholder), 'SAMPLE my answer');
    await press(a.saqShowPoints);
    expect(screen.getByText('SAMPLE model answer')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: a.tick('SAMPLE point one') }));
    expect(screen.getByText(a.verdicts.partial)).toBeOnTheScreen();
    await press(p.seeResults);

    const { attempt, responses } = await savedAttempt();
    expect(attempt).toMatchObject({ mode: 'practice', score: 1 + 1 + 2 + 1, maxScore: 7 });
    expect(responses.map((r) => [r.response.score, r.response.isCorrect])).toEqual([
      [1, true],
      [1, false],
      [2, true],
      [1, false],
    ]);
    expect(parseResponse('saq', responses[3].response.responseJson)).toEqual({
      text: 'SAMPLE my answer',
      ticked: ['m1'],
      marked: true,
    });
    // Two answers were fully right: 1 XP each, paid once for this attempt.
    const earned = await mockDb.select().from(xpEvents);
    expect(earned.map((e) => [e.source, e.sourceId, e.amount])).toEqual([
      ['quiz_correct_own', attempt.id, 2],
    ]);
  });

  it('can finish early from the leave sheet, or leave without saving', async () => {
    await start();
    await fireEvent.press(screen.getByRole('radio', { name: a.option('A', 'SAMPLE alpha') }));
    await press(p.check);
    await press(p.close);
    expect(await screen.findByText(p.leaveMessage)).toBeOnTheScreen();
    await press(p.leaveFinish);
    const { attempt, responses } = await savedAttempt();
    expect(attempt.score).toBe(1);
    expect(responses).toHaveLength(4);
    expect(responses.slice(1).every((r) => r.response.responseJson === null)).toBe(true);
  });

  it('retries only the questions that weren’t fully right', async () => {
    const rows = await listQuizQuestions(mockDb, quizId);
    const items = buildPlayItems(
      rows.map((row) => ({
        questionId: row.question.id,
        points: row.points,
        question: questionToDraft(row.question) as QuestionDraft,
      })),
      DEFAULT_QUIZ_SETTINGS,
    );
    const attempt = await saveAttempt(mockDb, {
      ownerId: owner,
      quizId,
      mode: 'practice',
      settings: DEFAULT_QUIZ_SETTINGS,
      startedAt: new Date(Date.UTC(2026, 9, 25)).toISOString(),
      result: buildAttemptResult(
        items,
        { [items[0].questionId]: { choice: 'o1' } },
        DEFAULT_QUIZ_SETTINGS,
      ),
    });

    await renderWithProviders(<QuizPlayerScreen quizId={quizId} retryOf={attempt.id} />);
    expect(await screen.findByText(p.introRetry(3))).toBeOnTheScreen();
    await press(p.begin);
    // The SBA was right, so the retry starts with the MTF.
    expect(screen.getByText(p.progress(1, 3), { exact: false })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: a.markTrue(1) })).toBeOnTheScreen();
  });
});

describe('quiz player: exam mode', () => {
  beforeEach(async () => {
    await updateQuizSettings(mockDb, quizId, {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: 'exam',
      timeLimitSec: 600,
      negativeMarking: true,
    });
  });

  it('moves freely with flags and the grid, then self-marks short answers and saves', async () => {
    await renderWithProviders(<QuizPlayerScreen quizId={quizId} retryOf={null} />);
    expect(await screen.findByText(p.introExam(10))).toBeOnTheScreen();
    expect(screen.getByText(p.introNegative)).toBeOnTheScreen();
    await press(p.begin);
    expect(screen.getByLabelText(p.timeLeftLabel('10:00'))).toBeOnTheScreen();

    // Q1: answer wrongly (no feedback in an exam) and flag it.
    await fireEvent.press(screen.getByRole('radio', { name: a.option('B', 'SAMPLE beta') }));
    expect(screen.queryByText(a.verdicts.wrong)).toBeNull();
    await press(p.flag);
    expect(screen.getByText(p.flagged)).toBeOnTheScreen();
    await press(p.nextExam);

    // Q2: MTF, one wrong statement with negative marking.
    await fireEvent.press(screen.getByRole('radio', { name: a.markFalse(1) }));
    await press(p.nextExam);
    await press(p.previous);
    expect(screen.getByRole('radio', { name: a.markFalse(1) })).toBeChecked();

    // The grid jumps to the last question.
    await press(p.grid);
    expect(await screen.findByText(p.gridSummary(2, 4, 1))).toBeOnTheScreen();
    await press(p.gridCell(4, false, false, false));
    await fireEvent.changeText(screen.getByPlaceholderText(a.saqPlaceholder), 'SAMPLE exam answer');

    // Submit warns about the unanswered fill-in.
    await press(p.submit);
    expect(await screen.findByText(p.submitUnanswered(1))).toBeOnTheScreen();
    await press(p.submitConfirm);

    // Mark the short answer, then save.
    expect(await screen.findByText(p.markTitle)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: a.tick('SAMPLE point two') }));
    await press(p.markDone);

    const { attempt, responses } = await savedAttempt();
    expect(attempt).toMatchObject({ mode: 'exam', maxScore: 7 });
    expect(responses.map((r) => r.response.score)).toEqual([0, -1, 0, 1]);
    expect(attempt.score).toBe(0);
    expect(responses[0].response.flagged).toBe(true);
    expect(parseResponse('saq', responses[3].response.responseJson)?.ticked).toEqual(['m2']);
  });

  it('hands the answers in when time runs out', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 9, 25, 10, 0) });
    try {
      await start();
      await fireEvent.press(screen.getByRole('radio', { name: a.option('A', 'SAMPLE alpha') }));
      await act(async () => {
        jest.advanceTimersByTime(601_000);
      });
      expect(screen.getByText(p.timeUp)).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
    const { attempt } = await savedAttempt();
    expect(attempt.score).toBe(1);
  });
});

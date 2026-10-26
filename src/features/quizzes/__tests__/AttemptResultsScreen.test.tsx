import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { AppDatabase } from '@/db/types';
import { listCards, listDecks } from '@/features/decks/repo';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';
import { sampleQuestions } from '@/test-utils/sampleQuestions';

import { AttemptResultsScreen } from '../components/AttemptResultsScreen';
import { buildAttemptResult, buildPlayItems, questionToDraft, type QuestionDraft } from '../logic';
import { createQuestionInQuiz, createQuiz, listQuizQuestions, saveAttempt } from '../repo';
import { DEFAULT_QUIZ_SETTINGS } from '../types';

// The results screen against a real (in-memory) database.
// SAMPLE content for tests only — made-up words, no drug facts.
const r = strings.quizzes.results;
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
let attemptId: string;

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = createLiveTestDatabase();
  const quiz = await createQuiz(mockDb, { ownerId: owner, title: 'SAMPLE quiz' });
  quizId = quiz.id;
  for (const type of ['sba', 'mtf', 'fill_blank'] as const) {
    await createQuestionInQuiz(mockDb, { ownerId: owner, quizId, draft: sampleQuestions[type] });
  }
  const rows = await listQuizQuestions(mockDb, quizId);
  const items = buildPlayItems(
    rows.map((row) => ({
      questionId: row.question.id,
      points: row.points,
      question: questionToDraft(row.question) as QuestionDraft,
    })),
    DEFAULT_QUIZ_SETTINGS,
  );
  // SBA right, MTF half right, fill-in not answered: 2 of 5 points.
  const attempt = await saveAttempt(mockDb, {
    ownerId: owner,
    quizId,
    mode: 'exam',
    settings: { ...DEFAULT_QUIZ_SETTINGS, mode: 'exam', passMark: 60 },
    startedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    result: buildAttemptResult(
      items,
      {
        [items[0].questionId]: { choice: 'o1' },
        [items[1].questionId]: { answers: { s1: true, s2: true } },
      },
      DEFAULT_QUIZ_SETTINGS,
    ),
  });
  attemptId = attempt.id;
});

async function renderResults() {
  await renderWithProviders(<AttemptResultsScreen attemptId={attemptId} />);
  await screen.findByText(r.percent(40));
}

describe('attempt results', () => {
  it('shows the score, the pass mark, how many were fully right and the time', async () => {
    await renderResults();
    expect(screen.getByText(r.score('2', '5'))).toBeOnTheScreen();
    expect(screen.getByText(r.notYet(60))).toBeOnTheScreen();
    expect(screen.getByLabelText(`${r.correct}: ${r.correctValue(1, 3)}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${r.time}: ${r.minutes(3)}`)).toBeOnTheScreen();
  });

  it('reviews every answer, or only the ones not fully right', async () => {
    await renderResults();
    await fireEvent.press(screen.getByRole('button', { name: r.review }));
    expect(await screen.findByText('SAMPLE because')).toBeOnTheScreen();
    expect(screen.getByText(a.verdicts.right)).toBeOnTheScreen();
    expect(screen.getByText(a.verdicts.partial)).toBeOnTheScreen();
    expect(screen.getAllByText(a.verdicts.blank).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: r.showWrong }));
    await waitFor(() => expect(screen.queryByText(a.verdicts.right)).toBeNull());
    expect(screen.getByText(a.verdicts.partial)).toBeOnTheScreen();
  });

  it('retries only the wrong ones, or the whole quiz', async () => {
    await renderResults();
    await fireEvent.press(screen.getByRole('button', { name: r.retryWrong(2) }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/quiz/[id]/play',
      params: { id: quizId, retry: attemptId },
    });
    await fireEvent.press(screen.getByRole('button', { name: r.retake }));
    expect(router.replace).toHaveBeenLastCalledWith({
      pathname: '/quiz/[id]/play',
      params: { id: quizId },
    });
  });

  it('adds the wrong ones to a new deck as flashcards', async () => {
    await renderResults();
    await fireEvent.press(screen.getByRole('button', { name: r.addToCards }));
    const title = r.newDeckTitle('SAMPLE quiz');
    await fireEvent.press(await screen.findByRole('button', { name: r.newDeck(title) }));
    expect(await screen.findByText(r.addedToCards(2, title))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: r.alreadyAdded })).toBeDisabled();

    const [deck] = await listDecks(mockDb, owner);
    expect(deck.title).toBe(title);
    const cards = await listCards(mockDb, deck.id);
    expect(cards.map((c) => c.type).sort()).toEqual(['basic', 'cloze']);
  });
});

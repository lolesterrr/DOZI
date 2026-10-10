import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { AppDatabase } from '@/db/types';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';
import { field, sampleQuestions } from '@/test-utils/sampleQuestions';

import { QuestionBankScreen } from '../components/QuestionBankScreen';
import { createQuestion, createQuestionInQuiz, createQuiz } from '../repo';

// The question bank against a real (in-memory) database.
// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.questions;
const owner = 'owner-1';

let mockDb: AppDatabase;
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'owner-1', timezone: 'Africa/Kampala' } }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('expo-router'),
    router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = createLiveTestDatabase();
});

describe('question bank', () => {
  it('shows a friendly empty state with "New question"', async () => {
    await renderWithProviders(<QuestionBankScreen />);
    expect(await screen.findByText(s.empty.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.newQuestion }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/question/[id]', params: { id: 'new' } });
  });

  it('lists questions with where they are used, searches and filters by type', async () => {
    const quiz = await createQuiz(mockDb, { ownerId: owner, title: 'SAMPLE quiz' });
    const used = await createQuestionInQuiz(mockDb, {
      ownerId: owner,
      quizId: quiz.id,
      draft: { ...sampleQuestions.sba, stem: field('SAMPLE wug question') },
    });
    await createQuestion(mockDb, {
      ownerId: owner,
      draft: { ...sampleQuestions.mtf, stem: field('SAMPLE blick question') },
    });
    await renderWithProviders(<QuestionBankScreen />);
    expect(await screen.findByText('SAMPLE wug question')).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE blick question')).toBeOnTheScreen();
    expect(await screen.findByText(s.usedIn(1))).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(s.searchLabel), 'wug');
    expect(screen.queryByText('SAMPLE blick question')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(s.searchLabel), '');
    await fireEvent.press(screen.getByRole('button', { name: s.types.mtf }));
    expect(screen.queryByText('SAMPLE wug question')).toBeNull();
    expect(screen.getByText('SAMPLE blick question')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(s.searchLabel), 'zzz');
    expect(screen.getByText(s.noMatches)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: s.allTypes }));
    await fireEvent.changeText(screen.getByLabelText(s.searchLabel), '');
    await fireEvent.press(screen.getByRole('button', { name: s.open('SAMPLE wug question') }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/question/[id]',
      params: { id: used.id },
    });
  });
});

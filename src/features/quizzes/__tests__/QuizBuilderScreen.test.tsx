import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { AppDatabase } from '@/db/types';
import { strings } from '@/i18n/strings';
import { createLiveTestDatabase } from '@/test-utils/liveQueries';
import { renderWithProviders } from '@/test-utils/render';
import { field, sampleQuestions } from '@/test-utils/sampleQuestions';

import { QuizBuilderScreen } from '../components/QuizBuilderScreen';
import {
  createQuestion,
  createQuestionInQuiz,
  createQuiz,
  getQuiz,
  listQuizQuestions,
} from '../repo';
import { parseQuizSettings } from '../types';

// The quiz builder against a real (in-memory) database whose writes re-run live queries.
// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.quizzes;
const owner = 'owner-1';

let mockDb: AppDatabase;
jest.mock('expo-sqlite', () => jest.requireActual('@/test-utils/liveQueries').expoSqliteMock);
jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => mockDb }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'owner-1', timezone: 'Africa/Kampala' } }),
}));
jest.mock('@/features/library/hooks', () => ({
  useFolders: () => [],
  useTags: () => [],
  useItemTagMap: () => new Map(),
  useLibraryActions: () => ({ setItemTags: jest.fn(), createTag: jest.fn() }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('expo-router'),
    router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
    // No navigator in this test: "focus" is simply mounting (and re-running on new deps).
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const stem = (text: string) => ({ ...sampleQuestions.sba, stem: field(text) });

let quizId: string;

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = createLiveTestDatabase();
  const quiz = await createQuiz(mockDb, { ownerId: owner, title: 'SAMPLE quiz' });
  quizId = quiz.id;
  for (const text of ['SAMPLE first', 'SAMPLE second']) {
    await createQuestionInQuiz(mockDb, { ownerId: owner, quizId, draft: stem(text) });
  }
  await createQuestionInQuiz(mockDb, {
    ownerId: owner,
    quizId,
    draft: { ...sampleQuestions.mtf, stem: field('SAMPLE third') },
  });
});

const order = async () =>
  (await listQuizQuestions(mockDb, quizId)).map((row) => row.question.stemText);

async function renderBuilder() {
  await renderWithProviders(<QuizBuilderScreen id={quizId} />);
  await screen.findByText('SAMPLE first');
}

describe('quiz builder', () => {
  it('lists the questions in order with their type and points', async () => {
    await renderBuilder();
    expect(screen.getByText('SAMPLE quiz')).toBeOnTheScreen();
    expect(screen.getByText(s.summary(3, 4))).toBeOnTheScreen();
    expect(screen.getByText(s.settingsSummary('practice', null))).toBeOnTheScreen();
    expect(
      screen.getByText(`${s.row.number(3)} · ${strings.questions.types.mtf} · ${s.row.points(2)}`),
    ).toBeOnTheScreen();
  });

  it('moves a question down and up', async () => {
    await renderBuilder();
    await fireEvent.press(screen.getByLabelText(`${s.row.moveDown}: ${s.row.number(1)}`));
    await waitFor(async () =>
      expect(await order()).toEqual(['SAMPLE second', 'SAMPLE first', 'SAMPLE third']),
    );
    // The list follows the database.
    await waitFor(() =>
      expect(screen.getByLabelText(s.row.label(1, 'SAMPLE second'))).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByLabelText(`${s.row.moveUp}: ${s.row.number(3)}`));
    await waitFor(async () =>
      expect(await order()).toEqual(['SAMPLE second', 'SAMPLE third', 'SAMPLE first']),
    );
  });

  it('removes a question from the quiz, with undo', async () => {
    await renderBuilder();
    await fireEvent.press(screen.getByLabelText(s.row.more(2)));
    await fireEvent.press(screen.getByRole('button', { name: s.row.remove }));
    await waitFor(async () => expect(await order()).toEqual(['SAMPLE first', 'SAMPLE third']));
    expect(screen.getByText(s.row.removed)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: strings.library.undo }));
    await waitFor(async () =>
      expect(await order()).toEqual(['SAMPLE first', 'SAMPLE second', 'SAMPLE third']),
    );
  });

  it('changes a question’s points', async () => {
    await renderBuilder();
    await fireEvent.press(screen.getByLabelText(s.row.more(1)));
    await fireEvent.press(screen.getByRole('button', { name: s.row.setPoints }));
    await fireEvent.changeText(screen.getByLabelText(s.points.label), '0');
    await fireEvent.press(screen.getByRole('button', { name: s.points.save }));
    expect(screen.getByText(s.points.problem(1, 100))).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(s.points.label), '4');
    await fireEvent.press(screen.getByRole('button', { name: s.points.save }));
    await waitFor(async () => expect((await listQuizQuestions(mockDb, quizId))[0].points).toBe(4));
    expect(await screen.findByText(s.summary(3, 7))).toBeOnTheScreen();
  });

  it('saves exam-mode settings', async () => {
    await renderBuilder();
    await fireEvent.press(screen.getByRole('button', { name: s.actions.settings }));
    await fireEvent.press(screen.getByRole('radio', { name: s.settings.modes.exam }));
    await fireEvent.changeText(screen.getByLabelText(s.settings.timeLimit), '30');
    await fireEvent(screen.getByLabelText(s.settings.negativeMarking), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: s.settings.save }));
    await waitFor(async () =>
      expect(parseQuizSettings((await getQuiz(mockDb, quizId))?.settingsJson)).toMatchObject({
        mode: 'exam',
        timeLimitSec: 1800,
        negativeMarking: true,
      }),
    );
    expect(await screen.findByText(s.settingsSummary('exam', 30))).toBeOnTheScreen();
  });

  it('writes a new question of a chosen type in this quiz', async () => {
    await renderBuilder();
    await fireEvent.press(screen.getByRole('button', { name: s.addQuestion }));
    await fireEvent.press(screen.getByRole('button', { name: s.writeNew }));
    await fireEvent.press(screen.getByRole('button', { name: strings.questions.types.matching }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/question/[id]',
      params: { id: 'new', quizId, type: 'matching' },
    });
  });

  it('adds questions from the bank, showing ones already in the quiz', async () => {
    await createQuestion(mockDb, {
      ownerId: owner,
      draft: { ...sampleQuestions.saq, stem: field('SAMPLE banked') },
    });
    await renderBuilder();
    await fireEvent.press(screen.getByRole('button', { name: s.addQuestion }));
    await fireEvent.press(screen.getByRole('button', { name: s.fromBank }));
    const picker = await screen.findByRole('checkbox', {
      name: strings.questions.select('SAMPLE banked'),
    });
    const already = screen.getByRole('checkbox', {
      name: strings.questions.select('SAMPLE first'),
    });
    expect(already).toBeDisabled();
    expect(within(already).getByText(strings.questions.inQuiz)).toBeOnTheScreen();
    await fireEvent.press(picker);
    await fireEvent.press(screen.getByRole('button', { name: strings.questions.addSelected(1) }));
    await waitFor(async () => expect((await order()).at(-1)).toBe('SAMPLE banked'));
    expect(await screen.findByText('SAMPLE banked')).toBeOnTheScreen();
  });

  it('deletes the quiz, with undo', async () => {
    await renderBuilder();
    await fireEvent.press(screen.getByLabelText(s.moreOptions));
    await fireEvent.press(screen.getByRole('button', { name: s.actions.delete }));
    await waitFor(async () => expect((await getQuiz(mockDb, quizId))?.deletedAt).not.toBeNull());
    expect(router.back).toHaveBeenCalled();
  });

  it('says so when the quiz is gone', async () => {
    await renderWithProviders(<QuizBuilderScreen id="missing" />);
    expect(await screen.findByText(s.missingTitle)).toBeOnTheScreen();
  });
});

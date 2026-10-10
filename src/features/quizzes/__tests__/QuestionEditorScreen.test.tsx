import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Question, Quiz } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';
import { sampleQuestions } from '@/test-utils/sampleQuestions';

import { QuestionEditorScreen } from '../components/QuestionEditorScreen';
import { useQuestion, useQuiz } from '../hooks';
import { questionDraftProblem, summariseQuestion, type QuestionDraft } from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.
const s = strings.questions;

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

const mockActions = {
  createQuestion: jest.fn(async () => ({ id: 'q-new' })),
  createQuestionInQuiz: jest.fn(async () => ({ id: 'q-new' })),
  updateQuestion: jest.fn(async () => {}),
  deleteQuestion: jest.fn(async () => 'deleted-at'),
  restoreQuestion: jest.fn(async () => {}),
  quizIdsUsingQuestion: jest.fn(async () => ['quiz-1', 'quiz-2']),
};
jest.mock('../hooks', () => ({
  useQuestion: jest.fn(),
  useQuiz: jest.fn(),
  useQuizActions: () => mockActions,
}));

jest.mock('@/features/media/hooks', () => ({
  useAddImage: () => jest.fn(),
  useDeleteMedia: () => jest.fn(async () => {}),
  useMediaUri: () => ({ uri: null, loading: false }),
}));

const quiz = { id: 'quiz-1', title: 'SAMPLE quiz', deletedAt: null } as Quiz;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useQuiz).mockReturnValue({ quiz, loading: false });
  jest.mocked(useQuestion).mockReturnValue({ question: undefined, loading: false });
});

const type = (label: string, text: string, index = 0) =>
  fireEvent.changeText(screen.getAllByLabelText(label)[index], text);

/** What the screen saved (the draft handed to the action). */
const savedDraft = (): QuestionDraft => {
  const calls = mockActions.createQuestionInQuiz.mock.calls as unknown as [string, QuestionDraft][];
  return calls[calls.length - 1][1];
};

async function newQuestion(questionType?: string) {
  await renderWithProviders(
    <QuestionEditorScreen questionId="new" quizId="quiz-1" type={questionType} />,
  );
}

const save = () => fireEvent.press(screen.getByRole('button', { name: s.save }));

describe('question editor: one of each type', () => {
  it('writes an SBA with a rationale and adds it to the quiz', async () => {
    await newQuestion();
    expect(screen.getByText(s.newTitle)).toBeOnTheScreen();
    expect(screen.getByText('SAMPLE quiz')).toBeOnTheScreen();
    await type(s.stem, 'SAMPLE stem');
    await type(s.optionLabel('A'), 'SAMPLE a');
    await type(s.optionLabel('B'), 'SAMPLE b');
    await type(s.why, 'SAMPLE because', 1);
    await fireEvent.press(screen.getByLabelText(s.markCorrect('B')));
    await save();
    const draft = savedDraft();
    expect(mockActions.createQuestionInQuiz).toHaveBeenCalledWith('quiz-1', expect.anything());
    expect(questionDraftProblem(draft)).toBeNull();
    expect(summariseQuestion(draft)).toMatchObject({ type: 'sba', stemText: 'SAMPLE stem' });
    if (draft.type !== 'sba') throw new Error('type');
    expect(draft.payload.options.slice(0, 2)).toEqual([
      { id: 'o1', text: 'SAMPLE a', correct: false, why: '' },
      { id: 'o2', text: 'SAMPLE b', correct: true, why: 'SAMPLE because' },
    ]);
    expect(router.back).toHaveBeenCalled();
  });

  it('writes an MTF with a false statement', async () => {
    await newQuestion('mtf');
    await type(s.stem, 'SAMPLE stem');
    await type(s.statementLabel(1), 'SAMPLE one');
    await type(s.statementLabel(2), 'SAMPLE two');
    await fireEvent.press(screen.getByLabelText(`${s.statementLabel(2)}: ${s.false}`));
    await save();
    const draft = savedDraft();
    if (draft.type !== 'mtf') throw new Error('type');
    expect(questionDraftProblem(draft)).toBeNull();
    expect(draft.payload.statements.slice(0, 2).map((st) => st.answer)).toEqual([true, false]);
  });

  it('writes a multiple-response question with two correct options', async () => {
    await newQuestion('multiple_response');
    await type(s.stem, 'SAMPLE stem');
    await type(s.optionLabel('A'), 'SAMPLE a');
    await type(s.optionLabel('B'), 'SAMPLE b');
    await type(s.optionLabel('C'), 'SAMPLE c');
    await fireEvent.press(screen.getByLabelText(s.markCorrect('A')));
    await fireEvent.press(screen.getByLabelText(s.markCorrect('C')));
    await save();
    const draft = savedDraft();
    if (draft.type !== 'multiple_response') throw new Error('type');
    expect(questionDraftProblem(draft)).toBeNull();
    expect(draft.payload.options.filter((o) => o.correct).map((o) => o.id)).toEqual(['o1', 'o3']);
  });

  it('makes a blank from the selected word and saves extra accepted answers', async () => {
    await newQuestion('fill_blank');
    const sentence = 'The SAMPLE wug is blue';
    await type(s.blankText, sentence);
    const start = sentence.indexOf('wug');
    await fireEvent(screen.getByLabelText(s.blankText), 'selectionChange', {
      nativeEvent: { selection: { start, end: start + 3 } },
    });
    await fireEvent.press(screen.getByRole('button', { name: s.makeBlank }));
    expect(screen.getByLabelText(s.blankText).props.value).toBe('The SAMPLE {{1}} is blue');
    expect(screen.getByText(s.blankCount(1))).toBeOnTheScreen();
    await type(s.blankAnswers('1'), 'wug\nwugs');
    await save();
    const draft = savedDraft();
    if (draft.type !== 'fill_blank') throw new Error('type');
    expect(questionDraftProblem(draft)).toBeNull();
    expect(draft.payload).toEqual({
      text: 'The SAMPLE {{1}} is blue',
      blanks: [{ id: '1', answers: ['wug', 'wugs'] }],
    });
  });

  it('writes a matching question', async () => {
    await newQuestion('matching');
    await type(s.stem, 'SAMPLE stem');
    await type(s.left, 'SAMPLE left 1', 0);
    await type(s.right, 'SAMPLE right A', 0);
    await type(s.left, 'SAMPLE left 2', 1);
    await type(s.right, 'SAMPLE right B', 1);
    await save();
    const draft = savedDraft();
    expect(questionDraftProblem(draft)).toBeNull();
    expect(summariseQuestion(draft).payloadJson).toBe(
      JSON.stringify({
        pairs: [
          { id: 'p1', left: 'SAMPLE left 1', right: 'SAMPLE right A' },
          { id: 'p2', left: 'SAMPLE left 2', right: 'SAMPLE right B' },
        ],
      }),
    );
  });

  it('writes an SAQ with marking points and a model answer', async () => {
    await newQuestion('saq');
    await type(s.stem, 'SAMPLE stem');
    await type(s.markingPointLabel(1), 'SAMPLE point');
    await type(s.modelAnswer, 'SAMPLE model');
    await save();
    const draft = savedDraft();
    expect(questionDraftProblem(draft)).toBeNull();
    expect(summariseQuestion(draft).payloadJson).toBe(
      JSON.stringify({
        marking_points: [{ id: 'm1', text: 'SAMPLE point' }],
        model_answer: 'SAMPLE model',
      }),
    );
  });
});

describe('question editor', () => {
  it('explains what is missing instead of saving', async () => {
    await newQuestion();
    await type(s.stem, 'SAMPLE stem');
    await type(s.optionLabel('A'), 'SAMPLE a');
    await type(s.optionLabel('B'), 'SAMPLE b');
    await save();
    expect(screen.getByText(s.problems.oneCorrect)).toBeOnTheScreen();
    expect(mockActions.createQuestionInQuiz).not.toHaveBeenCalled();
  });

  it('switches type, keeping the stem', async () => {
    await newQuestion();
    await type(s.stem, 'SAMPLE stem');
    await fireEvent.press(screen.getByRole('radio', { name: s.types.saq }));
    expect(screen.getByText(s.typeHints.saq)).toBeOnTheScreen();
    expect(screen.getByLabelText(s.stem).props.value).toBe('SAMPLE stem');
    expect(screen.getByLabelText(s.markingPointLabel(1))).toBeOnTheScreen();
  });

  it('adds and removes options', async () => {
    await newQuestion();
    expect(screen.queryByLabelText(s.optionLabel('E'))).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: s.addOption }));
    expect(screen.getByLabelText(s.optionLabel('E'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(s.removeOption('A')));
    expect(screen.queryByLabelText(s.optionLabel('E'))).toBeNull();
  });

  it('saves a question to the bank only when there is no quiz', async () => {
    jest.mocked(useQuiz).mockReturnValue({ quiz: undefined, loading: false });
    await renderWithProviders(<QuestionEditorScreen questionId="new" type="saq" />);
    expect(screen.getByText(s.bankTitle)).toBeOnTheScreen();
    await type(s.stem, 'SAMPLE stem');
    await type(s.markingPointLabel(1), 'SAMPLE point');
    await save();
    expect(mockActions.createQuestion).toHaveBeenCalled();
    expect(mockActions.createQuestionInQuiz).not.toHaveBeenCalled();
  });

  it('edits a saved question (type fixed), says where it is used, and deletes with undo', async () => {
    const question = {
      id: 'q1',
      deletedAt: null,
      ...summariseQuestion(sampleQuestions.mtf),
    } as Question;
    jest.mocked(useQuestion).mockReturnValue({ question, loading: false });
    await renderWithProviders(<QuestionEditorScreen questionId="q1" quizId="quiz-1" />);
    expect(screen.getByText(s.editTitle)).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: s.types.sba })).toBeNull();
    expect(await screen.findByText(s.usedInEditing(2))).toBeOnTheScreen();

    await type(s.stem, 'SAMPLE changed');
    await save();
    expect(mockActions.updateQuestion).toHaveBeenCalledWith(
      'q1',
      expect.objectContaining({ type: 'mtf', stem: { text: 'SAMPLE changed', mediaIds: [] } }),
    );

    await fireEvent.press(screen.getByRole('button', { name: s.deleteQuestion }));
    expect(mockActions.deleteQuestion).toHaveBeenCalledWith('q1');
    await fireEvent.press(screen.getByRole('button', { name: strings.library.undo }));
    expect(mockActions.restoreQuestion).toHaveBeenCalledWith('q1', 'deleted-at');
  });

  it('says so when the question is gone', async () => {
    jest.mocked(useQuestion).mockReturnValue({
      question: { id: 'q1', deletedAt: 'then' } as Question,
      loading: false,
    });
    await renderWithProviders(<QuestionEditorScreen questionId="q1" />);
    expect(screen.getByText(s.missingTitle)).toBeOnTheScreen();
  });

  it('says so when a saved question cannot be read', async () => {
    jest.mocked(useQuestion).mockReturnValue({
      question: {
        id: 'q1',
        deletedAt: null,
        ...summariseQuestion(sampleQuestions.sba),
        payloadJson: '{',
      } as Question,
      loading: false,
    });
    await renderWithProviders(<QuestionEditorScreen questionId="q1" />);
    expect(screen.getByText(s.unreadable)).toBeOnTheScreen();
    await act(async () => {});
  });
});

import type { QuestionDraft } from '@/features/quizzes/logic';

// SAMPLE quiz questions for tests only — made-up words, no drug facts.

export const field = (text: string, mediaIds: string[] = []) => ({ text, mediaIds });
export const choice = (id: string, text: string, correct = false, why = '') => ({
  id,
  text,
  correct,
  why,
});

export function draft(partial: Partial<QuestionDraft> & Pick<QuestionDraft, 'type' | 'payload'>) {
  return {
    stem: field('SAMPLE stem'),
    explanation: field(''),
    difficulty: 2,
    ...partial,
  } as QuestionDraft;
}

/** One complete, saveable question of every type. */
export const sampleQuestions: Record<string, QuestionDraft> = {
  sba: draft({
    type: 'sba',
    payload: {
      options: [
        choice('o1', 'SAMPLE alpha', true, 'SAMPLE because'),
        choice('o2', 'SAMPLE beta'),
        choice('o3', 'SAMPLE gamma'),
      ],
    },
  }),
  mtf: draft({
    type: 'mtf',
    payload: {
      statements: [
        { id: 's1', text: 'SAMPLE one', answer: true, why: '' },
        { id: 's2', text: 'SAMPLE two', answer: false, why: 'SAMPLE why' },
      ],
    },
  }),
  multiple_response: draft({
    type: 'multiple_response',
    payload: {
      options: [
        choice('o1', 'SAMPLE a', true),
        choice('o2', 'SAMPLE b', true),
        choice('o3', 'SAMPLE c'),
      ],
    },
  }),
  fill_blank: draft({
    type: 'fill_blank',
    stem: field(''),
    payload: {
      text: 'The SAMPLE {{1}} sits next to the {{2}}.',
      blanks: [
        { id: '1', answers: ['wug', 'wugs'] },
        { id: '2', answers: ['blick'] },
      ],
    },
  }),
  matching: draft({
    type: 'matching',
    payload: {
      pairs: [
        { id: 'p1', left: 'SAMPLE left 1', right: 'SAMPLE right A' },
        { id: 'p2', left: 'SAMPLE left 2', right: 'SAMPLE right B' },
      ],
    },
  }),
  saq: draft({
    type: 'saq',
    payload: {
      marking_points: [
        { id: 'm1', text: 'SAMPLE point one' },
        { id: 'm2', text: 'SAMPLE point two' },
      ],
      model_answer: 'SAMPLE model answer',
    },
  }),
};

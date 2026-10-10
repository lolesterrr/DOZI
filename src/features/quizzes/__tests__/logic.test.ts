import {
  answersToLines,
  blankIdsInText,
  blankPlainText,
  changeQuestionType,
  cleanQuizTitle,
  defaultPoints,
  emptyPayload,
  emptyQuestionDraft,
  filterQuestions,
  linesToAnswers,
  makeBlank,
  moveInList,
  nextItemId,
  parsePoints,
  parseQuizSettingsForm,
  questionDraftProblem,
  questionToDraft,
  questionTypes,
  quizSettingsToForm,
  quizTitleProblem,
  summariseQuestion,
  syncBlanks,
  tidyQuestionDraft,
  totalPoints,
  type QuestionDraft,
} from '../logic';
import { choice, draft, field, sampleQuestions } from '@/test-utils/sampleQuestions';

import { DEFAULT_QUIZ_SETTINGS, parsePayload, parseQuizSettings } from '../types';

// SAMPLE content for tests only — made-up words, no drug facts.

describe('quiz titles and points', () => {
  it('cleans and checks titles', () => {
    expect(cleanQuizTitle('  SAMPLE   quiz ')).toBe('SAMPLE quiz');
    expect(quizTitleProblem('   ')).toBe('empty');
    expect(quizTitleProblem('x'.repeat(81))).toBe('tooLong');
    expect(quizTitleProblem('SAMPLE')).toBeNull();
  });

  it.each([
    ['1', 1],
    [' 25 ', 25],
    ['100', 100],
    ['0', null],
    ['101', null],
    ['2.5', null],
    ['', null],
    ['abc', null],
  ])('parsePoints(%p) = %p', (text, expected) => {
    expect(parsePoints(text)).toBe(expected);
  });

  it('gives each type its natural number of marks', () => {
    expect(defaultPoints(sampleQuestions.sba)).toBe(1);
    expect(defaultPoints(sampleQuestions.mtf)).toBe(2);
    expect(defaultPoints(sampleQuestions.multiple_response)).toBe(2);
    expect(defaultPoints(sampleQuestions.fill_blank)).toBe(2);
    expect(defaultPoints(sampleQuestions.matching)).toBe(2);
    expect(defaultPoints(sampleQuestions.saq)).toBe(2);
    // Never less than 1.
    expect(defaultPoints({ type: 'mtf', payload: { statements: [] } })).toBe(1);
  });

  it('adds up points', () => {
    expect(totalPoints([{ points: 1 }, { points: 5 }])).toBe(6);
    expect(totalPoints([])).toBe(0);
  });

  it('moves list items up and down, ignoring moves off the ends', () => {
    expect(moveInList(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveInList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveInList(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveInList(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('quiz settings', () => {
  it('round-trips the defaults through the form', () => {
    const parsed = parseQuizSettingsForm(quizSettingsToForm(DEFAULT_QUIZ_SETTINGS));
    expect(parsed).toEqual({ ok: true, settings: DEFAULT_QUIZ_SETTINGS });
  });

  it('turns exam minutes into seconds; empty means no limit', () => {
    const form = { ...quizSettingsToForm(DEFAULT_QUIZ_SETTINGS), mode: 'exam' as const };
    expect(parseQuizSettingsForm({ ...form, timeLimitMinutes: '45' })).toMatchObject({
      ok: true,
      settings: { mode: 'exam', timeLimitSec: 2700 },
    });
    expect(parseQuizSettingsForm({ ...form, timeLimitMinutes: ' ' })).toMatchObject({
      ok: true,
      settings: { timeLimitSec: null },
    });
  });

  it('ignores the time limit in practice mode', () => {
    const form = { ...quizSettingsToForm(DEFAULT_QUIZ_SETTINGS), timeLimitMinutes: 'abc' };
    expect(parseQuizSettingsForm(form)).toMatchObject({
      ok: true,
      settings: { timeLimitSec: null },
    });
  });

  it('reports bad numbers per field', () => {
    const form = {
      ...quizSettingsToForm(DEFAULT_QUIZ_SETTINGS),
      mode: 'exam' as const,
      timeLimitMinutes: '999',
      passMark: 'x',
    };
    expect(parseQuizSettingsForm(form)).toEqual({
      ok: false,
      errors: { timeLimitMinutes: 'outOfRange', passMark: 'notNumber' },
    });
  });

  it('reads saved settings, filling gaps and falling back on broken JSON', () => {
    expect(parseQuizSettings(null)).toEqual(DEFAULT_QUIZ_SETTINGS);
    expect(parseQuizSettings('not json')).toEqual(DEFAULT_QUIZ_SETTINGS);
    expect(parseQuizSettings('{"mode":"exam"}')).toEqual({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: 'exam',
    });
    expect(parseQuizSettings('{"mode":"party"}')).toEqual(DEFAULT_QUIZ_SETTINGS);
  });
});

describe('question drafts', () => {
  it('starts every type with rows to type into', () => {
    for (const type of questionTypes) {
      const fresh = emptyQuestionDraft(type);
      expect(fresh.type).toBe(type);
      expect(parsePayload(type, JSON.stringify(fresh.payload))).not.toBeNull();
    }
    expect(emptyPayload('sba')).toMatchObject({ payload: { options: expect.any(Array) } });
  });

  it('gives the next free item id', () => {
    expect(nextItemId('o', [])).toBe('o1');
    expect(nextItemId('o', [{ id: 'o1' }, { id: 'o7' }, { id: 'x9' }])).toBe('o8');
  });

  it('keeps options when switching between SBA and multiple response', () => {
    const multi = changeQuestionType(sampleQuestions.multiple_response, 'sba');
    expect(multi.type).toBe('sba');
    if (multi.type !== 'sba') throw new Error('type');
    // An SBA keeps only the first correct option.
    expect(multi.payload.options.map((o) => o.correct)).toEqual([true, false, false]);
    expect(multi.stem).toEqual(sampleQuestions.multiple_response.stem);
    const back = changeQuestionType(multi, 'multiple_response');
    if (back.type !== 'multiple_response') throw new Error('type');
    expect(back.payload.options.map((o) => o.text)).toEqual(['SAMPLE a', 'SAMPLE b', 'SAMPLE c']);
  });

  it('starts a fresh payload for other type changes, keeping stem and explanation', () => {
    const changed = changeQuestionType(
      { ...sampleQuestions.sba, explanation: field('SAMPLE why'), difficulty: 3 },
      'saq',
    );
    expect(changed).toMatchObject({
      type: 'saq',
      stem: field('SAMPLE stem'),
      explanation: field('SAMPLE why'),
      difficulty: 3,
    });
  });

  it('drops fully empty rows when tidying', () => {
    const tidied = tidyQuestionDraft(
      draft({
        type: 'sba',
        payload: {
          options: [
            choice('o1', ' SAMPLE a ', true),
            choice('o2', ''),
            choice('o3', '', false, 'SAMPLE why'),
          ],
        },
      }),
    );
    if (tidied.type !== 'sba') throw new Error('type');
    expect(tidied.payload.options.map((o) => o.id)).toEqual(['o1', 'o3']);
    expect(tidied.payload.options[0].text).toBe('SAMPLE a');
  });

  it('accepts one complete question of every type', () => {
    for (const question of Object.values(sampleQuestions)) {
      expect(questionDraftProblem(question)).toBeNull();
    }
  });

  const sba = sampleQuestions.sba;
  it.each<[string, QuestionDraft, string]>([
    ['no stem', { ...sba, stem: field('  ') }, 'stemEmpty'],
    [
      'one option',
      draft({ type: 'sba', payload: { options: [choice('o1', 'a', true)] } }),
      'tooFewOptions',
    ],
    [
      'an option with only a rationale',
      draft({
        type: 'sba',
        payload: { options: [choice('o1', 'a', true), choice('o2', '', false, 'why')] },
      }),
      'optionEmpty',
    ],
    [
      'two correct SBA options',
      draft({
        type: 'sba',
        payload: { options: [choice('o1', 'a', true), choice('o2', 'b', true)] },
      }),
      'oneCorrect',
    ],
    [
      'no correct SBA option',
      draft({ type: 'sba', payload: { options: [choice('o1', 'a'), choice('o2', 'b')] } }),
      'oneCorrect',
    ],
    [
      'no correct multiple-response option',
      draft({
        type: 'multiple_response',
        payload: { options: [choice('o1', 'a'), choice('o2', 'b')] },
      }),
      'noCorrect',
    ],
    ['no statements', draft({ type: 'mtf', payload: { statements: [] } }), 'noStatements'],
    [
      'a statement with no text',
      draft({
        type: 'mtf',
        payload: { statements: [{ id: 's1', text: '', answer: true, why: 'w' }] },
      }),
      'statementEmpty',
    ],
    [
      'no fill-in text',
      draft({ type: 'fill_blank', payload: { text: ' ', blanks: [] } }),
      'blankTextEmpty',
    ],
    [
      'no blanks',
      draft({ type: 'fill_blank', payload: { text: 'SAMPLE', blanks: [] } }),
      'noBlanks',
    ],
    [
      'a blank with no answer',
      draft({
        type: 'fill_blank',
        payload: { text: 'A {{1}}', blanks: [{ id: '1', answers: [' '] }] },
      }),
      'blankNoAnswer',
    ],
    [
      'one pair',
      draft({ type: 'matching', payload: { pairs: [{ id: 'p1', left: 'a', right: 'b' }] } }),
      'tooFewPairs',
    ],
    [
      'a half-filled pair',
      draft({
        type: 'matching',
        payload: {
          pairs: [
            { id: 'p1', left: 'a', right: 'b' },
            { id: 'p2', left: 'c', right: '' },
          ],
        },
      }),
      'pairEmpty',
    ],
    [
      'the same left item twice',
      draft({
        type: 'matching',
        payload: {
          pairs: [
            { id: 'p1', left: 'A', right: 'b' },
            { id: 'p2', left: 'a', right: 'c' },
          ],
        },
      }),
      'duplicateLeft',
    ],
    [
      'no marking points',
      draft({
        type: 'saq',
        payload: { marking_points: [{ id: 'm1', text: ' ' }], model_answer: '' },
      }),
      'noMarkingPoints',
    ],
    ['a too-long stem', { ...sba, stem: field('x'.repeat(5001)) }, 'tooLong'],
    [
      'too many images',
      { ...sba, stem: field('a', ['1', '2', '3', '4', '5', '6', '7']) },
      'tooManyImages',
    ],
  ])('refuses %s', (_name, question, problem) => {
    expect(questionDraftProblem(question)).toBe(problem);
  });

  it('lets a fill-in question go without a stem', () => {
    expect(questionDraftProblem({ ...sampleQuestions.fill_blank, stem: field('') })).toBeNull();
  });

  it('saves and reads back every type identically', () => {
    for (const question of Object.values(sampleQuestions)) {
      const saved = summariseQuestion(question);
      const row = { ...saved, difficulty: saved.difficulty as number };
      expect(questionToDraft(row)).toEqual(tidyQuestionDraft(question));
    }
  });

  it('keeps stem and explanation images as media:// refs', () => {
    const saved = summariseQuestion({
      ...sampleQuestions.sba,
      stem: field('SAMPLE', ['img-1']),
      explanation: field('', ['img-2']),
    });
    expect(saved.stemJson).toContain('media://img-1');
    expect(saved.explanationJson).toContain('media://img-2');
    expect(summariseQuestion(sampleQuestions.sba).explanationJson).toBeNull();
  });

  it('writes plain text for lists and search', () => {
    expect(summariseQuestion(sampleQuestions.sba).stemText).toBe('SAMPLE stem');
    expect(summariseQuestion(sampleQuestions.fill_blank).stemText).toBe(
      'The SAMPLE ___ sits next to the ___.',
    );
    expect(
      summariseQuestion({ ...sampleQuestions.fill_blank, stem: field('SAMPLE fill in') }).stemText,
    ).toBe('SAMPLE fill in\nThe SAMPLE ___ sits next to the ___.');
  });

  it('refuses rows it cannot read', () => {
    const saved = summariseQuestion(sampleQuestions.sba);
    expect(questionToDraft({ ...saved, type: 'hotspot' })).toBeNull();
    expect(questionToDraft({ ...saved, payloadJson: '{"options":"nope"}' })).toBeNull();
    expect(questionToDraft({ ...saved, payloadJson: '{' })).toBeNull();
    // An unknown difficulty falls back to medium.
    expect(questionToDraft({ ...saved, difficulty: 9 })?.difficulty).toBe(2);
  });
});

describe('fill in the blank', () => {
  it('finds blanks in order, once each', () => {
    expect(blankIdsInText('{{2}} and {{1}} and {{2}}')).toEqual(['2', '1']);
    expect(blankPlainText('a {{1}} b {{12}}')).toBe('a ___ b ___');
    // Cloze markers and stray braces are just text.
    expect(blankIdsInText('{{c1::x}} {{x}} {1}')).toEqual([]);
  });

  it('turns the selected words into a blank with them as the answer', () => {
    const text = 'The SAMPLE wug is blue';
    const start = text.indexOf('wug');
    const result = makeBlank(text, [], { start, end: start + 3 });
    expect(result.text).toBe('The SAMPLE {{1}} is blue');
    expect(result.blanks).toEqual([{ id: '1', answers: ['wug'] }]);
    expect(result.selection).toEqual({ start: start + 5, end: start + 5 });
  });

  it('keeps spaces selected around the words outside the blank', () => {
    const result = makeBlank('a wug b', [], { start: 1, end: 6 });
    expect(result.text).toBe('a {{1}} b');
    expect(result.blanks[0].answers).toEqual(['wug']);
  });

  it('inserts an empty blank at the cursor and numbers past any used id', () => {
    const result = makeBlank(
      'a {{1}} b ',
      [
        { id: '1', answers: ['x'] },
        { id: '3', answers: [] },
      ],
      {
        start: 10,
        end: 10,
      },
    );
    expect(result.text).toBe('a {{1}} b {{4}}');
    expect(result.blanks.at(-1)).toEqual({ id: '4', answers: [] });
  });

  it('syncs blanks with the text', () => {
    const blanks = [
      { id: '1', answers: ['x'] },
      { id: '2', answers: ['y'] },
    ];
    expect(syncBlanks('{{2}} then {{3}}', blanks)).toEqual([
      { id: '2', answers: ['y'] },
      { id: '3', answers: [] },
    ]);
  });

  it('reads answers one per line, without blanks or repeats', () => {
    expect(linesToAnswers(' wug \n\nWUG\nwugs  two\n')).toEqual(['wug', 'wugs two']);
    expect(answersToLines(['a', 'b'])).toBe('a\nb');
  });
});

describe('bank search', () => {
  const bank = [
    { id: '1', type: 'sba', stemText: 'SAMPLE wug question' },
    { id: '2', type: 'mtf', stemText: 'Another SAMPLE blick' },
  ];
  it('matches every word, any case, and filters by type', () => {
    expect(filterQuestions(bank, '').map((q) => q.id)).toEqual(['1', '2']);
    expect(filterQuestions(bank, 'sample WUG').map((q) => q.id)).toEqual(['1']);
    expect(filterQuestions(bank, 'sample', 'mtf').map((q) => q.id)).toEqual(['2']);
    expect(filterQuestions(bank, 'zzz')).toEqual([]);
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';

import { parseCsv } from '@/features/decks/csv';

import {
  draftQuestionKey,
  importedPoints,
  planQuizCsvImport,
  QUIZ_IMPORT_ROWS_MAX,
  quizToCsv,
} from '../csv';
import { summariseQuestion, type QuestionDraft } from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.

function plan(text: string) {
  const result = planQuizCsvImport(text);
  if (!result.ok) throw new Error(`Expected a plan, got ${result.error}`);
  return result.plan;
}

const header = 'type,question,A,B,C,D,E,answer,explanation,points,difficulty';

describe('planQuizCsvImport', () => {
  it('reads every question type', () => {
    const p = plan(
      [
        header,
        'sba,SAMPLE Which is a zib?,Zob,Wib,Zab,,,B,Wibs are zibs.,,easy',
        'multiple_response,SAMPLE Pick the wibs,Wib,Zob,Wab,,,"A, C",,,',
        'mtf,SAMPLE About zibs,Zibs are blue,Zibs fly,Zibs hum,,,"T,F,T",,,hard',
        'matching,SAMPLE Match them,Zib = Zob,Wib = Wob,,,,,,,',
        'saq,SAMPLE Explain zibs,Blue,Small,,,,A zib is a small blue zob.,,3,',
        'fill_blank,SAMPLE A {{zib|zibb}} is {{blue}},,,,,,,,,',
      ].join('\n'),
    );
    expect(p.skipped).toEqual([]);
    const [sba, mr, mtf, matching, saq, fill] = p.questions.map((q) => q.draft);
    expect(sba).toMatchObject({
      type: 'sba',
      stem: { text: 'SAMPLE Which is a zib?' },
      explanation: { text: 'Wibs are zibs.' },
      difficulty: 1,
      payload: {
        options: [
          { id: 'o1', text: 'Zob', correct: false },
          { id: 'o2', text: 'Wib', correct: true },
          { id: 'o3', text: 'Zab', correct: false },
        ],
      },
    });
    expect(mr.type === 'multiple_response' && mr.payload.options.map((o) => o.correct)).toEqual([
      true,
      false,
      true,
    ]);
    expect(mtf).toMatchObject({ type: 'mtf', difficulty: 3 });
    expect(mtf.type === 'mtf' && mtf.payload.statements.map((st) => st.answer)).toEqual([
      true,
      false,
      true,
    ]);
    expect(matching.type === 'matching' && matching.payload.pairs).toEqual([
      { id: 'p1', left: 'Zib', right: 'Zob' },
      { id: 'p2', left: 'Wib', right: 'Wob' },
    ]);
    expect(saq.type === 'saq' && saq.payload).toEqual({
      marking_points: [
        { id: 'm1', text: 'Blue' },
        { id: 'm2', text: 'Small' },
      ],
      model_answer: 'A zib is a small blue zob.',
    });
    expect(fill).toMatchObject({
      type: 'fill_blank',
      stem: { text: '' },
      payload: {
        text: 'SAMPLE A {{1}} is {{2}}',
        blanks: [
          { id: '1', answers: ['zib', 'zibb'] },
          { id: '2', answers: ['blue'] },
        ],
      },
    });
    expect(p.questions.map(importedPoints)).toEqual([1, 2, 3, 2, 3, 2]);
  });

  it('works out the type when the column is empty or missing', () => {
    const p = plan(
      [
        'question,A,B,C,answer',
        'SAMPLE one,Zob,Wib,Zab,c',
        'SAMPLE many,Zob,Wib,Zab,AB',
        'SAMPLE tf,Zob,Wib,Zab,TFT',
        'SAMPLE pairs,Zib = Zob,Wib = Wob,,',
        'SAMPLE the {{zib}} hums,,,,',
        'SAMPLE text,Zob,Wib,,Wib',
      ].join('\n'),
    );
    expect(p.questions.map((q) => q.draft.type)).toEqual([
      'sba',
      'multiple_response',
      'mtf',
      'matching',
      'fill_blank',
      'sba',
    ]);
  });

  it('takes a fill-in sentence from column A when the question is an instruction', () => {
    const p = plan('type,question,A\nfill,SAMPLE Fill it in,The {{zib}} hums\n');
    expect(p.questions[0].draft).toMatchObject({
      stem: { text: 'SAMPLE Fill it in' },
      payload: { text: 'The {{1}} hums' },
    });
  });

  it('lists the rows it can’t use, with why', () => {
    const p = plan(
      [
        header,
        'sba,SAMPLE ok,Zob,Wib,,,,A,,,',
        'sba,SAMPLE two answers,Zob,Wib,,,,"A,B",,,', // 3
        'sba,SAMPLE no answer,Zob,Wib,,,,,,,', // 4
        'sba,SAMPLE bad letter,Zob,Wib,,,,E,,,', // 5
        'mtf,SAMPLE short,Zib,Wib,,,,T,,,', // 6
        'matching,SAMPLE pairs,Zib = Zob,Wib,,,,,,,', // 7
        'essay,SAMPLE what,,,,,,,,,', // 8
        ',SAMPLE unclear,Zob,,,,,maybe,,,', // 9
        'sba,,Zob,Wib,,,,A,,,', // 10
        ',,,,,,,,,,', // blank: ignored
      ].join('\n'),
    );
    expect(p.questions).toHaveLength(1);
    expect(p.skipped).toEqual([
      { row: 3, reason: 'oneCorrect' },
      { row: 4, reason: 'answerUnclear' },
      { row: 5, reason: 'answerUnclear' },
      { row: 6, reason: 'answerUnclear' },
      { row: 7, reason: 'pairUnclear' },
      { row: 8, reason: 'typeUnknown' },
      { row: 9, reason: 'typeUnknown' },
      { row: 10, reason: 'stemEmpty' },
    ]);
  });

  it('reads option columns named "Option 1" or "option a", and semicolons', () => {
    const p = plan('Question;Option 1;Option b;Correct answer\nSAMPLE zib;Zob;Wib;B\n');
    expect(p.questions[0].draft.type).toBe('sba');
  });

  it('keeps points only when they are a whole number from 1 to 100', () => {
    const p = plan(
      'question,A,B,answer,points\nSAMPLE a,Z,W,A,5\nSAMPLE b,Z,W,A,0\nSAMPLE c,Z,W,A,x\n',
    );
    expect(p.questions.map((q) => q.points)).toEqual([5, null, null]);
  });

  it('needs a header with a question column, and says when nothing can be used', () => {
    expect(planQuizCsvImport('')).toEqual({ ok: false, error: 'empty' });
    expect(planQuizCsvImport('SAMPLE zib,Zob,Wib,A\n')).toEqual({ ok: false, error: 'noHeader' });
    expect(planQuizCsvImport('question,answer\n')).toEqual({ ok: false, error: 'empty' });
    expect(planQuizCsvImport('question,A,answer\nSAMPLE,Zob,\n')).toEqual({
      ok: false,
      error: 'noQuestions',
    });
  });

  it('reads at most QUIZ_IMPORT_ROWS_MAX rows', () => {
    const rows = Array.from({ length: QUIZ_IMPORT_ROWS_MAX + 1 }, (_, i) => `SAMPLE ${i},Z,W,A`);
    const p = plan(['question,A,B,answer', ...rows].join('\n'));
    expect(p.questions).toHaveLength(QUIZ_IMPORT_ROWS_MAX);
    expect(p.truncated).toBe(true);
  });
});

describe('quizToCsv', () => {
  const saved = (draft: QuestionDraft) => ({ ...summariseQuestion(draft) });

  it('round-trips every question type through import', () => {
    const csv = [
      header,
      'sba,"SAMPLE Which, ""quoted""?",Zob,Wib,Zab,,,B,Wibs are zibs.,4,easy',
      'multiple_response,SAMPLE Pick,Wib,Zob,Wab,,,"A, C",,,',
      'mtf,SAMPLE About,"Line one\nline two",Zibs fly,,,,"T,F",,,hard',
      'matching,SAMPLE Match,Zib = Zob,Wib = Wob,,,,,,,',
      'saq,SAMPLE Explain,Blue,Small,,,,A model answer.,,,',
      'fill_blank,SAMPLE Fill it,The {{zib|zibb}} hums,,,,,,,,',
      'fill_blank,SAMPLE The {{wib}} hums,,,,,,,,,',
    ].join('\n');
    const first = plan(csv).questions;
    const exported = quizToCsv(
      first.map((q) => ({ question: saved(q.draft), points: importedPoints(q) })),
    );
    expect(exported).toMatchObject({ exported: 7, withoutImages: 0, withoutRationales: 0 });
    expect(exported.csv.startsWith('﻿')).toBe(true);
    const again = plan(exported.csv).questions;
    expect(again.map((q) => draftQuestionKey(q.draft))).toEqual(
      first.map((q) => draftQuestionKey(q.draft)),
    );
    expect(again.map(importedPoints)).toEqual(first.map(importedPoints));
    expect(again.map((q) => q.draft.difficulty)).toEqual(first.map((q) => q.draft.difficulty));
  });

  it('writes as many lettered columns as the longest question needs', () => {
    const p = plan('question,A,B,C,D,E,F,answer\nSAMPLE,1,2,3,4,5,6,F\n');
    const { csv } = quizToCsv([{ question: saved(p.questions[0].draft), points: 1 }]);
    expect(parseCsv(csv.slice(1))[0]).toEqual([
      'type',
      'question',
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'answer',
      'explanation',
      'points',
      'difficulty',
    ]);
  });

  it('counts questions that lose their rationales', () => {
    const draft = plan('question,A,B,answer\nSAMPLE,Z,W,A\n').questions[0].draft;
    if (draft.type !== 'sba') throw new Error('expected sba');
    draft.payload.options[0].why = 'Because SAMPLE';
    expect(quizToCsv([{ question: saved(draft), points: 1 }]).withoutRationales).toBe(1);
  });
});

describe('the sample file in docs/samples', () => {
  it('imports every row', () => {
    const text = readFileSync(
      join(__dirname, '../../../../docs/samples/quiz-import-sample.csv'),
      'utf8',
    );
    const p = plan(text);
    expect(p.skipped).toEqual([]);
    expect(p.questions.map((q) => q.draft.type)).toEqual([
      'sba',
      'multiple_response',
      'mtf',
      'matching',
      'fill_blank',
      'fill_blank',
      'saq',
    ]);
  });
});

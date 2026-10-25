import { sampleQuestions } from '@/test-utils/sampleQuestions';

import {
  buildAttemptResult,
  buildPlayItems,
  checkBlank,
  distinctRights,
  formatClock,
  formatPoints,
  isAnswered,
  questionToCard,
  questionVerdict,
  scaleToPoints,
  scoreFillBlank,
  scoreMatching,
  scoreMtf,
  scoreMultipleResponse,
  scoreSaq,
  scoreSba,
  secondsLeft,
  setMatch,
  setStatementAnswer,
  summariseAttempt,
  toggleChoice,
  toggleMarkingPoint,
  unmarkedSaqs,
  type ItemResult,
  type PlayItem,
  type QuestionDraft,
} from '../logic';
import type { Choice, Statement } from '../types';
import { cardDraftProblem, parseCloze } from '@/features/decks/logic';

// SAMPLE content for tests only — made-up words, no drug facts.

const option = (id: string, correct = false): Choice => ({
  id,
  text: `SAMPLE ${id}`,
  correct,
  why: '',
});
const sbaOptions = [option('o1', true), option('o2'), option('o3'), option('o4')];
const mrOptions = [option('o1', true), option('o2', true), option('o3'), option('o4')];
const statements: Statement[] = [
  { id: 's1', text: 'SAMPLE one', answer: true, why: '' },
  { id: 's2', text: 'SAMPLE two', answer: false, why: '' },
  { id: 's3', text: 'SAMPLE three', answer: true, why: '' },
  { id: 's4', text: 'SAMPLE four', answer: false, why: '' },
  { id: 's5', text: 'SAMPLE five', answer: true, why: '' },
];

describe('scoreSba', () => {
  it.each([
    ['the correct option', 'o1', 1, true, 'right'],
    ['a wrong option', 'o2', 0, false, 'wrong'],
    ['nothing', null, 0, false, undefined],
  ])('%s', (_name, choice, score, isCorrect, picked) => {
    const res = scoreSba(sbaOptions, { choice });
    expect(res).toMatchObject({ score, max: 1, isCorrect, answered: choice !== null });
    if (picked && choice) expect(res.items[choice]).toBe(picked);
    if (choice !== 'o1') expect(res.items.o1).toBe('missed');
  });

  it('treats no response and an unknown option as not answered', () => {
    expect(scoreSba(sbaOptions, null)).toMatchObject({ score: 0, answered: false });
    expect(scoreSba(sbaOptions, { choice: 'zz' })).toMatchObject({ score: 0, answered: false });
  });
});

describe('scoreMultipleResponse', () => {
  it.each([
    ['both correct', ['o1', 'o2'], 2, true],
    ['one correct', ['o1'], 1, false],
    ['one correct, one wrong', ['o1', 'o3'], 0, false],
    ['both correct and one wrong', ['o1', 'o2', 'o3'], 1, false],
    ['only wrong ones (never below 0)', ['o3', 'o4'], 0, false],
    ['nothing', [], 0, false],
  ])('%s', (_name, choices, score, isCorrect) => {
    expect(scoreMultipleResponse(mrOptions, { choices })).toMatchObject({
      score,
      max: 2,
      isCorrect,
    });
  });

  it('marks each option', () => {
    const { items } = scoreMultipleResponse(mrOptions, { choices: ['o1', 'o3'] });
    expect(items).toEqual({ o1: 'right', o2: 'missed', o3: 'wrong', o4: 'neutral' });
  });
});

describe('scoreMtf', () => {
  const all = { s1: true, s2: false, s3: true, s4: false, s5: true };
  it.each([
    // [name, answers, negative marking, score, isCorrect]
    ['all right', all, false, 5, true],
    ['all right, negative marking', all, true, 5, true],
    ['two wrong', { ...all, s1: false, s2: true }, false, 3, false],
    ['two wrong, negative marking', { ...all, s1: false, s2: true }, true, 1, false],
    ['two unanswered, negative marking', { s1: true, s2: false, s3: true }, true, 3, false],
    [
      'all wrong, negative marking',
      { s1: false, s2: true, s3: false, s4: true, s5: false },
      true,
      -5,
      false,
    ],
    [
      'all wrong, no negative marking',
      { s1: false, s2: true, s3: false, s4: true, s5: false },
      false,
      0,
      false,
    ],
    ['nothing answered, negative marking', {}, true, 0, false],
  ])('%s', (_name, answers, negativeMarking, score, isCorrect) => {
    const res = scoreMtf(statements, { answers }, { negativeMarking });
    expect(res).toMatchObject({ score, max: 5, isCorrect });
  });

  it('marks each statement right, wrong or blank', () => {
    const { items } = scoreMtf(
      statements,
      { answers: { s1: true, s2: true } },
      { negativeMarking: false },
    );
    expect(items).toEqual({ s1: 'right', s2: 'wrong', s3: 'blank', s4: 'blank', s5: 'blank' });
  });
});

describe('checkBlank (fuzzy fill-in)', () => {
  it.each<[string, string[], string, ItemResult]>([
    ['exact', ['wug'], 'wug', 'right'],
    ['capitals and spaces', ['blick stone'], '  BLICK   stone ', 'right'],
    ['hyphens and punctuation', ['blick-stone'], 'blick stone.', 'right'],
    ['a synonym', ['wug', 'wugs'], 'Wugs', 'right'],
    ['Greek letter as a word', ['β-sample'], 'beta sample', 'right'],
    ['word as a Greek letter', ['beta2 sample'], 'β2-sample', 'right'],
    ['capital Greek letter', ['Δ sample'], 'delta sample', 'right'],
    ['micro sign and mu', ['µsample'], 'musample', 'right'],
    ['accents', ['sämple'], 'sample', 'right'],
    ['one slip in a long word', ['samplerix'], 'samplrix', 'close'],
    ['one swapped letter in a long word', ['samplerix'], 'samplerox', 'close'],
    ['two slips', ['samplerix'], 'smplrix', 'wrong'],
    ['one slip in a short word', ['wugga'], 'wugge', 'wrong'],
    ['a different number', ['125'], '120', 'wrong'],
    ['a long number with one slip', ['1000000'], '100000', 'wrong'],
    ['words with a number and one slip', ['sample 50 units'], 'sample 5 units', 'wrong'],
    ['nothing typed', ['wug'], '   ', 'blank'],
    ['only punctuation', ['wug'], '--', 'blank'],
  ])('%s', (_name, accepted, typed, expected) => {
    expect(checkBlank(accepted, typed)).toBe(expected);
  });
});

describe('scoreFillBlank', () => {
  const blanks = [
    { id: '1', answers: ['wug', 'wugs'] },
    { id: '2', answers: ['samplerix'] },
  ];
  it.each([
    ['both right', { '1': 'WUGS', '2': 'samplerix' }, 2, true],
    ['one close one right', { '1': 'wug', '2': 'samplrix' }, 2, true],
    ['one wrong', { '1': 'blick', '2': 'samplerix' }, 1, false],
    ['one blank', { '2': 'samplerix' }, 1, false],
    ['nothing', {}, 0, false],
  ])('%s', (_name, typed, score, isCorrect) => {
    expect(scoreFillBlank(blanks, { blanks: typed })).toMatchObject({ score, max: 2, isCorrect });
  });
});

describe('scoreMatching', () => {
  const pairs = [
    { id: 'p1', left: 'SAMPLE a', right: 'SAMPLE X' },
    { id: 'p2', left: 'SAMPLE b', right: 'SAMPLE Y' },
    { id: 'p3', left: 'SAMPLE c', right: 'SAMPLE X' },
  ];
  it.each([
    ['all right', { p1: 'SAMPLE X', p2: 'SAMPLE Y', p3: 'SAMPLE X' }, 3, true],
    ['case and spaces', { p1: 'sample  x', p2: 'SAMPLE Y ', p3: 'SAMPLE X' }, 3, true],
    ['one wrong', { p1: 'SAMPLE Y', p2: 'SAMPLE Y', p3: 'SAMPLE X' }, 2, false],
    ['one left out', { p1: 'SAMPLE X', p2: 'SAMPLE Y' }, 2, false],
    ['nothing', {}, 0, false],
  ])('%s', (_name, matches, score, isCorrect) => {
    expect(scoreMatching(pairs, { matches })).toMatchObject({ score, max: 3, isCorrect });
  });

  it('offers each right-hand text once', () => {
    expect(distinctRights(pairs)).toEqual(['SAMPLE X', 'SAMPLE Y']);
  });
});

describe('scoreSaq', () => {
  const points = [
    { id: 'm1', text: 'SAMPLE one' },
    { id: 'm2', text: 'SAMPLE two' },
    { id: 'm3', text: 'SAMPLE three' },
  ];
  it.each([
    ['every point ticked', ['m1', 'm2', 'm3'], 3, true],
    ['one point ticked', ['m2'], 1, false],
    ['none ticked', [], 0, false],
  ])('%s', (_name, ticked, score, isCorrect) => {
    const res = scoreSaq(points, { text: 'SAMPLE answer', ticked, marked: true });
    expect(res).toMatchObject({ score, max: 3, isCorrect, answered: true });
  });

  it('is not answered with nothing written or ticked', () => {
    expect(scoreSaq(points, { text: ' ', ticked: [], marked: false }).answered).toBe(false);
    expect(scoreSaq(points, null).answered).toBe(false);
  });
});

describe('points and verdicts', () => {
  it.each([
    [1, 1, 4, 4],
    [1, 2, 3, 1.5],
    [2, 3, 1, 0.67],
    [-1, 5, 5, -1],
    [0, 0, 5, 0],
  ])('scales %d / %d to %d points → %d', (score, max, points, expected) => {
    expect(scaleToPoints(score, max, points)).toBe(expected);
  });

  it('gives a verdict', () => {
    expect(questionVerdict({ score: 2, isCorrect: true })).toBe('right');
    expect(questionVerdict({ score: 1, isCorrect: false })).toBe('partial');
    expect(questionVerdict({ score: 0, isCorrect: false })).toBe('wrong');
    expect(questionVerdict({ score: -2, isCorrect: false })).toBe('wrong');
  });

  it('formats points', () => {
    expect(formatPoints(3)).toBe('3');
    expect(formatPoints(2.5)).toBe('2.5');
    expect(formatPoints(0.666)).toBe('0.7');
  });
});

// ---------------------------------------------------------------------------------------------

function item(question: QuestionDraft, questionId: string, points = 1): PlayItem {
  return buildPlayItems([{ questionId, points, question }], {
    shuffleQuestions: false,
    shuffleOptions: false,
  })[0];
}

describe('buildPlayItems', () => {
  const rows = ['a', 'b', 'c', 'd'].map((id) => ({
    questionId: id,
    points: 1,
    question: sampleQuestions.sba,
  }));

  it('keeps the quiz order and option order unless told to shuffle', () => {
    const items = buildPlayItems(rows, { shuffleQuestions: false, shuffleOptions: false });
    expect(items.map((i) => i.questionId)).toEqual(['a', 'b', 'c', 'd']);
    expect(items[0].optionOrder).toEqual(['o1', 'o2', 'o3']);
  });

  it('shuffles questions and options with the given random source', () => {
    const random = () => 0;
    const items = buildPlayItems(rows, { shuffleQuestions: true, shuffleOptions: true }, random);
    expect(items.map((i) => i.questionId)).toEqual(['b', 'c', 'd', 'a']);
    expect(items[0].optionOrder).toEqual(['o2', 'o3', 'o1']);
  });

  it('always shuffles matching choices', () => {
    const [matching] = buildPlayItems(
      [{ questionId: 'm', points: 2, question: sampleQuestions.matching }],
      { shuffleQuestions: false, shuffleOptions: false },
      () => 0,
    );
    expect(matching.matchChoices).toEqual(['SAMPLE right B', 'SAMPLE right A']);
  });
});

describe('answer helpers', () => {
  it('toggles SBA and multiple response choices', () => {
    expect(toggleChoice('sba', null, 'o1')).toEqual({ choice: 'o1' });
    expect(toggleChoice('sba', { choice: 'o1' }, 'o2')).toEqual({ choice: 'o2' });
    expect(toggleChoice('sba', { choice: 'o1' }, 'o1')).toEqual({ choice: null });
    expect(toggleChoice('multiple_response', { choices: ['o1'] }, 'o2')).toEqual({
      choices: ['o1', 'o2'],
    });
    expect(toggleChoice('multiple_response', { choices: ['o1', 'o2'] }, 'o1')).toEqual({
      choices: ['o2'],
    });
  });

  it('sets and clears MTF answers', () => {
    const one = setStatementAnswer(null, 's1', true);
    expect(one).toEqual({ answers: { s1: true } });
    expect(setStatementAnswer(one, 's1', false)).toEqual({ answers: { s1: false } });
    expect(setStatementAnswer(one, 's1', true)).toEqual({ answers: {} });
  });

  it('sets and clears matches and marking points', () => {
    const m = setMatch(null, 'p1', 'X');
    expect(m).toEqual({ matches: { p1: 'X' } });
    expect(setMatch(m, 'p1', null)).toEqual({ matches: {} });
    const t = toggleMarkingPoint({ text: 'a', ticked: [], marked: false }, 'm1');
    expect(t.ticked).toEqual(['m1']);
    expect(toggleMarkingPoint(t, 'm1').ticked).toEqual([]);
  });

  it('knows when a question has an answer', () => {
    const sba = item(sampleQuestions.sba, 'q');
    expect(isAnswered(sba, null)).toBe(false);
    expect(isAnswered(sba, { choice: null })).toBe(false);
    expect(isAnswered(sba, { choice: 'o2' })).toBe(true);
  });

  it('finds SAQs still to mark', () => {
    const saq = item(sampleQuestions.saq, 'q1');
    const sba = item(sampleQuestions.sba, 'q2');
    expect(unmarkedSaqs([saq, sba], {})).toEqual([saq]);
    expect(unmarkedSaqs([saq, sba], { q1: { text: 'x', ticked: [], marked: true } })).toEqual([]);
  });
});

describe('timer', () => {
  it('counts down and never goes below 0', () => {
    expect(secondsLeft(0, 600, 0)).toBe(600);
    expect(secondsLeft(0, 600, 1500)).toBe(599);
    expect(secondsLeft(0, 600, 700_000)).toBe(0);
  });

  it.each([
    [0, '0:00'],
    [75, '1:15'],
    [600, '10:00'],
    [3725, '1:02:05'],
  ])('formats %d seconds as %s', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});

describe('buildAttemptResult and summariseAttempt', () => {
  const items = [
    item(sampleQuestions.sba, 'q1', 2),
    item(sampleQuestions.mtf, 'q2', 2),
    item(sampleQuestions.fill_blank, 'q3', 2),
  ];

  it('scales each question to its points and adds them up', () => {
    const result = buildAttemptResult(
      items,
      {
        q1: { choice: 'o1' },
        q2: { answers: { s1: true, s2: true } },
        q3: null,
      },
      { negativeMarking: false },
      { timeMs: { q1: 1200.4 }, flagged: { q2: true } },
    );
    expect(result.responses).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        position: 0,
        score: 2,
        maxScore: 2,
        isCorrect: true,
        timeMs: 1200,
      }),
      expect.objectContaining({
        questionId: 'q2',
        position: 1,
        score: 1,
        isCorrect: false,
        flagged: true,
      }),
      expect.objectContaining({ questionId: 'q3', position: 2, score: 0, responseJson: null }),
    ]);
    expect(result).toMatchObject({ score: 3, maxScore: 6 });
  });

  it('lets negative marking take a question below 0 but never the whole quiz', () => {
    const result = buildAttemptResult(
      [items[1]],
      { q2: { answers: { s1: false, s2: true } } },
      { negativeMarking: true },
    );
    expect(result.responses[0].score).toBe(-2);
    expect(result.score).toBe(0);
  });

  it('summarises: percent, pass mark, wrong count and time taken', () => {
    const summary = summariseAttempt(
      {
        score: 3,
        maxScore: 6,
        startedAt: '2026-10-25T10:00:00.000Z',
        finishedAt: '2026-10-25T10:04:30.000Z',
      },
      [{ isCorrect: true }, { isCorrect: false }, { isCorrect: false }],
      50,
    );
    expect(summary).toEqual({
      score: 3,
      maxScore: 6,
      percent: 50,
      passed: true,
      questions: 3,
      correct: 1,
      wrong: 2,
      timeMs: 270_000,
    });
    expect(
      summariseAttempt({ score: 2, maxScore: 6, startedAt: 'x', finishedAt: null }, [], 50),
    ).toMatchObject({ percent: 33, passed: false, timeMs: 0 });
  });
});

describe('questionToCard', () => {
  const labels = {
    true: 'True',
    false: 'False',
    chooseAll: 'Choose all that apply.',
    modelAnswer: 'Model answer',
  };

  it.each(Object.keys(sampleQuestions))(
    'makes a card that can be saved from a %s question',
    (type) => {
      const card = questionToCard(sampleQuestions[type], labels);
      expect(cardDraftProblem(card)).toBeNull();
    },
  );

  it('turns an SBA into a basic card with the right option on the back', () => {
    const card = questionToCard(sampleQuestions.sba, labels);
    expect(card.type).toBe('basic');
    expect(card.front.text).toBe('SAMPLE stem\nA. SAMPLE alpha\nB. SAMPLE beta\nC. SAMPLE gamma');
    expect(card.back.text).toBe('A. SAMPLE alpha\nSAMPLE because');
  });

  it('turns fill in the blank into a cloze card, one cloze per blank', () => {
    const card = questionToCard(sampleQuestions.fill_blank, labels);
    expect(card.type).toBe('cloze');
    expect(card.front.text).toBe('The SAMPLE {{c1::wug}} sits next to the {{c2::blick}}.');
    expect(parseCloze(card.front.text).filter((p) => p.type === 'cloze')).toHaveLength(2);
  });

  it('writes MTF answers and keeps images and the explanation', () => {
    const card = questionToCard(
      {
        ...sampleQuestions.mtf,
        stem: { text: 'SAMPLE stem', mediaIds: ['m1'] },
        explanation: { text: 'SAMPLE explained', mediaIds: [] },
      },
      labels,
    );
    expect(card.back.text).toBe('1. True\n2. False\nSAMPLE why');
    expect(card.front.mediaIds).toEqual(['m1']);
    expect(card.extra.text).toBe('SAMPLE explained');
  });
});

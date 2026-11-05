import type { Question, QuestionType } from '@/db/schema';
import { detectSeparator, parseCsv, readDirectives, toCsv } from '@/features/decks/csv';

import {
  defaultPoints,
  MAX_MARKING_POINTS,
  MAX_OPTIONS,
  MAX_PAIRS,
  MAX_STATEMENTS,
  POINTS_LIMITS,
  questionDraftProblem,
  questionToDraft,
  summariseQuestion,
  tidyQuestionDraft,
  type Difficulty,
  type QuestionDraft,
  type QuestionProblem,
} from './logic';
import { payloadSchemas, type Blank } from './types';

// CSV import and export for quizzes (2026-11-05, at the developer's request). Pure, like
// `decks/csv.ts`, whose CSV reader and writer it uses. One question per row:
//
//   type,question,A,B,C,D,answer,explanation,points,difficulty
//   sba,SAMPLE: Which is a zib?,Zob,Wib,Zab,Wob,B,Wibs are zibs.,1,easy
//
// The lettered columns (A–L) hold what the type needs, and `answer` says which are right:
//   sba                one option letter                         B
//   multiple_response  every right letter                        A, C
//   mtf                one T or F per statement, in order        T, F, T, T, F
//   matching           each lettered cell is "left = right"      (answer left empty)
//   saq                lettered cells are the marking points     answer = model answer
//   fill_blank         the question has {{answer}} blanks; {{one|other}} accepts either. With
//                      an instruction in `question`, the sentence goes in column A instead.
// `type` can be left empty when the row makes it clear (a {{blank}}, T/F answers, one letter
// or several). `explanation`, `points` and `difficulty` (easy/medium/hard) are optional.

/** The letters of the item columns, in order. */
export const ITEM_LETTERS = 'ABCDEFGHIJKL'.split('');

export const QUIZ_IMPORT_ROWS_MAX = 2000;

type Column = 'type' | 'question' | 'answer' | 'explanation' | 'points' | 'difficulty';

const HEADER_ALIASES: Record<string, Column> = {
  type: 'type',
  'question type': 'type',
  question: 'question',
  stem: 'question',
  answer: 'answer',
  answers: 'answer',
  correct: 'answer',
  'correct answer': 'answer',
  key: 'answer',
  explanation: 'explanation',
  rationale: 'explanation',
  why: 'explanation',
  points: 'points',
  marks: 'points',
  difficulty: 'difficulty',
};

/** Words accepted in the type column. */
const TYPE_NAMES: Record<string, QuestionType> = {
  sba: 'sba',
  mcq: 'sba',
  'single best answer': 'sba',
  single: 'sba',
  multiple_response: 'multiple_response',
  'multiple response': 'multiple_response',
  mr: 'multiple_response',
  'select all': 'multiple_response',
  mtf: 'mtf',
  'multiple true false': 'mtf',
  'multiple true/false': 'mtf',
  'true/false': 'mtf',
  'true false': 'mtf',
  tf: 'mtf',
  fill_blank: 'fill_blank',
  'fill in the blank': 'fill_blank',
  'fill blank': 'fill_blank',
  fill: 'fill_blank',
  blank: 'fill_blank',
  matching: 'matching',
  match: 'matching',
  saq: 'saq',
  'short answer': 'saq',
  'short answer question': 'saq',
};

const DIFFICULTY_NAMES: Record<string, Difficulty> = {
  '1': 1,
  easy: 1,
  '2': 2,
  medium: 2,
  '3': 3,
  hard: 3,
};
const DIFFICULTY_WORDS: Record<Difficulty, string> = { 1: 'easy', 2: 'medium', 3: 'hard' };

export type QuizImportSkipReason =
  QuestionProblem | 'typeUnknown' | 'answerUnclear' | 'pairUnclear' | 'tooManyItems';

export type ImportedQuestion = {
  draft: QuestionDraft;
  /** Points from the file, or null for the question's default. */
  points: number | null;
};

export type QuizCsvImportPlan = {
  /** Questions ready to save, in file order. */
  questions: ImportedQuestion[];
  /** Rows that can't become a question, by their line in the file (1 = the header). */
  skipped: { row: number; reason: QuizImportSkipReason }[];
  truncated: boolean;
};

export type QuizCsvImportError = 'empty' | 'noHeader' | 'noQuestions';

type Columns = { named: Map<Column, number>; items: { letter: string; index: number }[] };

function letterOf(cell: string): string | null {
  const name = cell.trim().toLowerCase();
  const letter = /^(?:option\s*)?([a-l])$/.exec(name)?.[1];
  if (letter) return letter.toUpperCase();
  const number = /^option\s*(\d{1,2})$/.exec(name)?.[1];
  const n = number ? Number(number) : 0;
  return n >= 1 && n <= ITEM_LETTERS.length ? ITEM_LETTERS[n - 1] : null;
}

function headerColumns(row: readonly string[]): Columns | null {
  const named = new Map<Column, number>();
  const items: Columns['items'] = [];
  row.forEach((cell, index) => {
    const column = HEADER_ALIASES[cell.trim().toLowerCase()];
    if (column) {
      if (!named.has(column)) named.set(column, index);
      return;
    }
    const letter = letterOf(cell);
    if (letter && !items.some((i) => i.letter === letter)) items.push({ letter, index });
  });
  if (!named.has('question')) return null;
  items.sort((a, b) => ITEM_LETTERS.indexOf(a.letter) - ITEM_LETTERS.indexOf(b.letter));
  return { named, items };
}

/** A filled item cell: its column letter and text. */
type Item = { letter: string; text: string };

const BLANK_IN_TEXT = /\{\{([\s\S]*?)\}\}/g;
const HAS_BLANK = /\{\{[\s\S]*?\}\}/;

function answerLetters(answer: string, items: readonly Item[]): string[] | null {
  const trimmed = answer.trim().replace(/\band\b/gi, ',');
  if (!trimmed) return null;
  // The answer may be an option's own text.
  const byText = items.find((i) => i.text.toLowerCase() === answer.trim().toLowerCase());
  if (byText) return [byText.letter];
  const tokens = /[\s,;/&+]/.test(trimmed)
    ? trimmed.split(/[\s,;/&+]+/).filter(Boolean)
    : trimmed.length <= ITEM_LETTERS.length
      ? trimmed.split('')
      : [trimmed];
  const letters: string[] = [];
  for (const token of tokens) {
    const letter = token.trim().toUpperCase();
    if (!/^[A-L]$/.test(letter)) return null;
    if (!items.some((i) => i.letter === letter)) return null;
    if (!letters.includes(letter)) letters.push(letter);
  }
  return letters.length > 0 ? letters : null;
}

const TRUE_WORDS = new Set(['t', 'true', 'yes', 'y']);
const FALSE_WORDS = new Set(['f', 'false', 'no', 'n']);

function trueFalse(answer: string): boolean[] | null {
  const trimmed = answer.trim().toLowerCase();
  if (!trimmed) return null;
  const tokens = /[\s,;]/.test(trimmed)
    ? trimmed.split(/[\s,;]+/).filter(Boolean)
    : /^[tf]+$/.test(trimmed)
      ? trimmed.split('')
      : [trimmed];
  const values: boolean[] = [];
  for (const token of tokens) {
    if (TRUE_WORDS.has(token)) values.push(true);
    else if (FALSE_WORDS.has(token)) values.push(false);
    else return null;
  }
  return values;
}

function splitPair(text: string): { left: string; right: string } | null {
  const at = text.indexOf('=');
  if (at < 0) return null;
  const left = text.slice(0, at).trim();
  const right = text.slice(at + 1).trim();
  return left && right ? { left, right } : null;
}

/** `{{answer|other}}` blanks → the payload's `{{1}}` markers and accepted answers. */
function readBlanks(sentence: string): { text: string; blanks: Blank[] } {
  const blanks: Blank[] = [];
  const text = sentence.replace(BLANK_IN_TEXT, (_, inner: string) => {
    const id = String(blanks.length + 1);
    // Anki-style {{c1::answer}} works too.
    const body = inner.replace(/^c\d+::/i, '');
    const answers = body
      .split('|')
      .map((a) => a.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    blanks.push({ id, answers });
    return `{{${id}}}`;
  });
  return { text, blanks };
}

function guessType(question: string, items: readonly Item[], answer: string): QuestionType | null {
  if (HAS_BLANK.test(question) || HAS_BLANK.test(items[0]?.text ?? '')) return 'fill_blank';
  if (!answer.trim() && items.length >= 2 && items.every((i) => splitPair(i.text))) {
    return 'matching';
  }
  const tf = trueFalse(answer);
  if (tf && items.length > 0 && tf.length === items.length) return 'mtf';
  const letters = answerLetters(answer, items);
  if (letters) return letters.length === 1 ? 'sba' : 'multiple_response';
  return null;
}

const field = (text: string) => ({ text, mediaIds: [] });

/** Builds one row's question, or says why it can't. */
function rowToDraft(
  typeCell: string,
  question: string,
  items: readonly Item[],
  answer: string,
  explanation: string,
  difficulty: Difficulty,
): QuestionDraft | QuizImportSkipReason {
  const typeName = typeCell.trim().toLowerCase();
  const type = typeName ? TYPE_NAMES[typeName] : guessType(question, items, answer);
  if (!type) return 'typeUnknown';
  const common = { stem: field(question), explanation: field(explanation), difficulty };
  const ids = (prefix: string) => items.map((_, i) => `${prefix}${i + 1}`);

  switch (type) {
    case 'sba':
    case 'multiple_response': {
      if (items.length > MAX_OPTIONS) return 'tooManyItems';
      const letters = answerLetters(answer, items);
      if (!letters) return 'answerUnclear';
      if (type === 'sba' && letters.length !== 1) return 'oneCorrect';
      const optionIds = ids('o');
      const options = items.map((item, i) => ({
        id: optionIds[i],
        text: item.text,
        correct: letters.includes(item.letter),
        why: '',
      }));
      return { ...common, type, payload: { options } } as QuestionDraft;
    }
    case 'mtf': {
      if (items.length > MAX_STATEMENTS) return 'tooManyItems';
      const values = trueFalse(answer);
      if (!values || values.length !== items.length) return 'answerUnclear';
      const statementIds = ids('s');
      const statements = items.map((item, i) => ({
        id: statementIds[i],
        text: item.text,
        answer: values[i],
        why: '',
      }));
      return { ...common, type, payload: { statements } };
    }
    case 'matching': {
      if (items.length > MAX_PAIRS) return 'tooManyItems';
      const pairIds = ids('p');
      const pairs: { id: string; left: string; right: string }[] = [];
      for (const [i, item] of items.entries()) {
        const pair = splitPair(item.text);
        if (!pair) return 'pairUnclear';
        pairs.push({ id: pairIds[i], ...pair });
      }
      return { ...common, type, payload: { pairs } };
    }
    case 'saq': {
      if (items.length > MAX_MARKING_POINTS) return 'tooManyItems';
      const pointIds = ids('m');
      const points = items.map((item, i) => ({ id: pointIds[i], text: item.text }));
      return {
        ...common,
        type,
        payload: { marking_points: points, model_answer: answer.trim() },
      };
    }
    case 'fill_blank': {
      // The sentence is the question, or column A when the question is an instruction.
      const inQuestion = HAS_BLANK.test(question);
      const sentence = inQuestion ? question : (items[0]?.text ?? '');
      const { text, blanks } = readBlanks(sentence);
      return {
        ...common,
        stem: field(inQuestion ? '' : question),
        type,
        payload: { text, blanks },
      };
    }
  }
  return 'typeUnknown';
}

/** Reads a quiz CSV into questions, with the rows that can't be questions and why. */
export function planQuizCsvImport(
  input: string,
): { ok: true; plan: QuizCsvImportPlan } | { ok: false; error: QuizCsvImportError } {
  const text = input.replace(/^﻿/, '');
  const { body, options } = readDirectives(text);
  const rows = parseCsv(body, options.separator ?? detectSeparator(body));
  if (rows.length === 0) return { ok: false, error: 'empty' };
  const columns = headerColumns(rows[0]);
  if (!columns) return { ok: false, error: 'noHeader' };

  const dataRows = rows.slice(1, 1 + QUIZ_IMPORT_ROWS_MAX);
  const plan: QuizCsvImportPlan = {
    questions: [],
    skipped: [],
    truncated: rows.length - 1 > QUIZ_IMPORT_ROWS_MAX,
  };
  const cell = (row: readonly string[], column: Column) => {
    const index = columns.named.get(column);
    return index === undefined ? '' : (row[index] ?? '').replace(/\r\n?/g, '\n');
  };

  dataRows.forEach((row, i) => {
    const rowNumber = i + 2;
    const question = cell(row, 'question').trim();
    const items: Item[] = columns.items
      .map(({ letter, index }) => ({ letter, text: (row[index] ?? '').trim() }))
      .filter((item) => item.text !== '');
    const answer = cell(row, 'answer');
    if (!question && items.length === 0 && !answer.trim()) return;

    const difficulty = DIFFICULTY_NAMES[cell(row, 'difficulty').trim().toLowerCase()] ?? 2;
    const built = rowToDraft(
      cell(row, 'type'),
      question,
      items,
      answer,
      cell(row, 'explanation').trim(),
      difficulty,
    );
    if (typeof built === 'string') {
      plan.skipped.push({ row: rowNumber, reason: built });
      return;
    }
    const problem = questionDraftProblem(built);
    if (problem) {
      plan.skipped.push({ row: rowNumber, reason: problem });
      return;
    }
    const draft = tidyQuestionDraft(built);
    if (!payloadSchemas[draft.type].safeParse(draft.payload).success) {
      plan.skipped.push({ row: rowNumber, reason: 'tooLong' });
      return;
    }
    const pointsCell = Number(cell(row, 'points').trim());
    const points =
      Number.isInteger(pointsCell) &&
      pointsCell >= POINTS_LIMITS.min &&
      pointsCell <= POINTS_LIMITS.max
        ? pointsCell
        : null;
    plan.questions.push({ draft, points });
  });

  if (plan.questions.length === 0 && plan.skipped.length === 0) {
    return { ok: false, error: 'empty' };
  }
  if (plan.questions.length === 0) return { ok: false, error: 'noQuestions' };
  return { ok: true, plan };
}

/** The points an imported question is worth in the quiz. */
export function importedPoints(question: ImportedQuestion): number {
  return question.points ?? defaultPoints(question.draft);
}

/** Questions with the same type, wording and answers count as the same question. */
export function questionMatchKey(question: {
  type: string;
  stemJson: string;
  payloadJson: string;
}): string {
  return `${question.type}\u0000${question.stemJson}\u0000${question.payloadJson}`;
}

export function draftQuestionKey(draft: QuestionDraft): string {
  return questionMatchKey(summariseQuestion(draft));
}

export type QuizImportEffect = {
  /** The questions the import adds, in file order. */
  toAdd: ImportedQuestion[];
  /** Rows that are already in the quiz (same type, wording and answers): left out. */
  alreadyInQuiz: number;
  /** Rows repeating an earlier row of the file: added once. */
  repeated: number;
};

/**
 * What an import adds to a quiz: every question except ones the quiz already has and repeats
 * within the file, so importing a file twice doesn't double the quiz.
 */
export function planQuizImport(
  imported: readonly ImportedQuestion[],
  existingKeys: readonly string[],
): QuizImportEffect {
  const inQuiz = new Set(existingKeys);
  const seen = new Set<string>();
  const effect: QuizImportEffect = { toAdd: [], alreadyInQuiz: 0, repeated: 0 };
  for (const question of imported) {
    const key = draftQuestionKey(question.draft);
    if (inQuiz.has(key)) effect.alreadyInQuiz += 1;
    else if (seen.has(key)) effect.repeated += 1;
    else {
      seen.add(key);
      effect.toAdd.push(question);
    }
  }
  return effect;
}

// ---------------------------------------------------------------------------------------------
// Export

export type QuizCsvExport = {
  csv: string;
  exported: number;
  /** Questions written without their images (only text goes in a CSV). */
  withoutImages: number;
  /** Questions whose per-option "why" notes were left out. */
  withoutRationales: number;
};

/** A blank's text back in the `{{answer|other}}` form the import reads. */
function writeBlanks(text: string, blanks: readonly Blank[]): string {
  const byId = new Map(blanks.map((b) => [b.id, b]));
  return text.replace(/\{\{(\d{1,2})\}\}/g, (_, id: string) => {
    const answers = byId.get(id)?.answers ?? [];
    return `{{${answers.join('|')}}}`;
  });
}

type ExportableQuestion = Pick<
  Question,
  'type' | 'stemJson' | 'payloadJson' | 'explanationJson' | 'difficulty'
>;

/**
 * A quiz as CSV text in the format `planQuizCsvImport` reads, so a quiz can be shared, edited
 * in a spreadsheet and imported again. Starts with a byte-order mark for spreadsheet apps.
 */
export function quizToCsv(
  rows: readonly { question: ExportableQuestion; points: number }[],
): QuizCsvExport {
  const body: { type: string; question: string; items: string[]; rest: string[] }[] = [];
  let withoutImages = 0;
  let withoutRationales = 0;
  for (const row of rows) {
    const draft = questionToDraft(row.question);
    if (!draft) continue;
    const stem = draft.stem.text.trim();
    const explanation = draft.explanation.text.trim();
    if (draft.stem.mediaIds.length + draft.explanation.mediaIds.length > 0) withoutImages += 1;
    let question = stem;
    let items: string[] = [];
    let answer = '';
    switch (draft.type) {
      case 'sba':
      case 'multiple_response': {
        const { options } = draft.payload;
        items = options.map((o) => o.text);
        answer = options
          .map((o, i) => (o.correct ? ITEM_LETTERS[i] : null))
          .filter((l): l is string => l !== null)
          .join(', ');
        if (options.some((o) => o.why.trim())) withoutRationales += 1;
        break;
      }
      case 'mtf': {
        const { statements } = draft.payload;
        items = statements.map((st) => st.text);
        answer = statements.map((st) => (st.answer ? 'T' : 'F')).join(', ');
        if (statements.some((st) => st.why.trim())) withoutRationales += 1;
        break;
      }
      case 'matching':
        items = draft.payload.pairs.map((p) => `${p.left} = ${p.right}`);
        break;
      case 'saq':
        items = draft.payload.marking_points.map((m) => m.text);
        answer = draft.payload.model_answer;
        break;
      case 'fill_blank': {
        const sentence = writeBlanks(draft.payload.text, draft.payload.blanks);
        if (stem) items = [sentence];
        else question = sentence;
        break;
      }
    }
    body.push({
      type: draft.type,
      question,
      items,
      rest: [answer, explanation, String(row.points), DIFFICULTY_WORDS[draft.difficulty]],
    });
  }
  const letters = ITEM_LETTERS.slice(0, Math.max(4, ...body.map((r) => r.items.length)));
  const header = ['type', 'question', ...letters, 'answer', 'explanation', 'points', 'difficulty'];
  const lines = [
    header,
    ...body.map((r) => [r.type, r.question, ...letters.map((_, i) => r.items[i] ?? ''), ...r.rest]),
  ];
  return { csv: `﻿${toCsv(lines)}`, exported: body.length, withoutImages, withoutRationales };
}

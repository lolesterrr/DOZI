import { z } from 'zod';

import { questionTypes, type QuestionType } from '@/db/schema';
import {
  docToField,
  emptyField,
  FIELD_IMAGES_MAX,
  FIELD_TEXT_MAX,
  fieldToDoc,
  isFieldEmpty,
  type CardField,
  type TextSelection,
} from '@/features/decks/logic';

import {
  parsePayload,
  parseQuizSettings,
  type Blank,
  type Choice,
  type MarkingPoint,
  type Pair,
  type QuizMode,
  type QuizSettings,
  type Statement,
  type TypedPayload,
} from './types';

// Pure rules for the question bank and the quiz builder (PRODUCT_SPEC §4.3): question drafts for
// each type, checking a question before saving, fill-in-the-blank markers, points, quiz titles
// and settings. No React and no database, so all of it is unit-tested. Scoring arrives with the
// quiz player (task 1.11) in this file too.

export { questionTypes, type QuestionType };

export function isQuestionType(type: string): type is QuestionType {
  return (questionTypes as readonly string[]).includes(type);
}

// ---------------------------------------------------------------------------------------------
// Quizzes

export const QUIZ_TITLE_MAX = 80;
export const QUIZ_DESCRIPTION_MAX = 300;

/** Trims and collapses runs of spaces. */
export function cleanQuizTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

export type QuizTitleProblem = 'empty' | 'tooLong';

export function quizTitleProblem(title: string): QuizTitleProblem | null {
  const cleaned = cleanQuizTitle(title);
  if (!cleaned) return 'empty';
  if (cleaned.length > QUIZ_TITLE_MAX) return 'tooLong';
  return null;
}

/** Points one question is worth in a quiz. */
export const POINTS_LIMITS = { min: 1, max: 100 };

/** Checks typed points: a whole number from 1 to 100. */
export function parsePoints(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const points = Number(trimmed);
  return points >= POINTS_LIMITS.min && points <= POINTS_LIMITS.max ? points : null;
}

/**
 * The points a question is worth when it joins a quiz: its natural number of marks (one per MTF
 * statement, blank, pair, marking point or correct option; 1 for an SBA). The student can change
 * it in the quiz builder.
 */
export function defaultPoints(question: TypedPayload): number {
  const count = (() => {
    switch (question.type) {
      case 'sba':
        return 1;
      case 'multiple_response':
        return question.payload.options.filter((o) => o.correct).length;
      case 'mtf':
        return question.payload.statements.length;
      case 'fill_blank':
        return question.payload.blanks.length;
      case 'matching':
        return question.payload.pairs.length;
      case 'saq':
        return question.payload.marking_points.length;
    }
  })();
  return Math.min(POINTS_LIMITS.max, Math.max(POINTS_LIMITS.min, count));
}

/** Total points of a quiz's questions. */
export function totalPoints(rows: readonly { points: number }[]): number {
  return rows.reduce((sum, row) => sum + row.points, 0);
}

/** Moves one item of a list up (-1) or down (+1). Out of range leaves the list as it is. */
export function moveInList<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ---------------------------------------------------------------------------------------------
// Quiz settings form

export const TIME_LIMIT_MINUTES = { min: 1, max: 360 };

/** What the settings form holds: switches, and text typed into the number fields. */
export type QuizSettingsForm = {
  mode: QuizMode;
  /** Minutes; empty = no time limit. Exam mode only. */
  timeLimitMinutes: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** Percent. */
  passMark: string;
  negativeMarking: boolean;
};

export type QuizSettingsField = 'timeLimitMinutes' | 'passMark';

export function quizSettingsToForm(settings: QuizSettings): QuizSettingsForm {
  return {
    mode: settings.mode,
    timeLimitMinutes:
      settings.timeLimitSec === null ? '' : String(Math.round(settings.timeLimitSec / 60)),
    shuffleQuestions: settings.shuffleQuestions,
    shuffleOptions: settings.shuffleOptions,
    passMark: String(settings.passMark),
    negativeMarking: settings.negativeMarking,
  };
}

const wholeNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'notNumber')
    .transform(Number)
    .pipe(z.number().min(min, 'outOfRange').max(max, 'outOfRange'));

type NumberProblem = 'notNumber' | 'outOfRange';

function checkNumber(
  text: string,
  min: number,
  max: number,
): { ok: true; value: number } | { ok: false; problem: NumberProblem } {
  const result = wholeNumber(min, max).safeParse(text);
  if (result.success) return { ok: true, value: result.data };
  const outOfRange = result.error.issues.some((i) => i.message === 'outOfRange');
  return { ok: false, problem: outOfRange ? 'outOfRange' : 'notNumber' };
}

/** Checks the settings form. Each bad number field gets 'notNumber' or 'outOfRange'. */
export function parseQuizSettingsForm(
  form: QuizSettingsForm,
):
  | { ok: true; settings: QuizSettings }
  | { ok: false; errors: Partial<Record<QuizSettingsField, NumberProblem>> } {
  const errors: Partial<Record<QuizSettingsField, NumberProblem>> = {};
  // The time limit only matters in exam mode; in practice mode it is cleared. Empty = no limit.
  let timeLimitSec: number | null = null;
  if (form.mode === 'exam' && form.timeLimitMinutes.trim() !== '') {
    const minutes = checkNumber(
      form.timeLimitMinutes,
      TIME_LIMIT_MINUTES.min,
      TIME_LIMIT_MINUTES.max,
    );
    if (minutes.ok) timeLimitSec = minutes.value * 60;
    else errors.timeLimitMinutes = minutes.problem;
  }
  const passMark = checkNumber(form.passMark, 0, 100);
  if (!passMark.ok) errors.passMark = passMark.problem;
  if (!passMark.ok || errors.timeLimitMinutes) return { ok: false, errors };
  return {
    ok: true,
    settings: {
      mode: form.mode,
      timeLimitSec,
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
      passMark: passMark.value,
      negativeMarking: form.negativeMarking,
    },
  };
}

export { parseQuizSettings };

// ---------------------------------------------------------------------------------------------
// Question drafts

export type Difficulty = 1 | 2 | 3;
export const difficulties: readonly Difficulty[] = [1, 2, 3];

/** What the question editor holds: stem and explanation (text + images), and the typed payload. */
export type QuestionDraft = TypedPayload & {
  stem: CardField;
  explanation: CardField;
  difficulty: Difficulty;
};

/** The next free id for a list item: `o1`, `o2`… (one more than the biggest number used). */
export function nextItemId(prefix: string, used: readonly { id: string }[]): string {
  let max = 0;
  for (const { id } of used) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

export function emptyChoice(id: string): Choice {
  return { id, text: '', correct: false, why: '' };
}

export function emptyStatement(id: string): Statement {
  return { id, text: '', answer: true, why: '' };
}

export function emptyPair(id: string): Pair {
  return { id, left: '', right: '' };
}

export function emptyMarkingPoint(id: string): MarkingPoint {
  return { id, text: '' };
}

const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

/** A new question's type and payload, with a few empty rows to type into. */
export function emptyPayload(type: QuestionType): TypedPayload {
  switch (type) {
    case 'sba':
      return { type, payload: { options: ids('o', 4).map(emptyChoice) } };
    case 'multiple_response':
      return { type, payload: { options: ids('o', 4).map(emptyChoice) } };
    case 'mtf':
      return { type, payload: { statements: ids('s', 5).map(emptyStatement) } };
    case 'fill_blank':
      return { type, payload: { text: '', blanks: [] } };
    case 'matching':
      return { type, payload: { pairs: ids('p', 3).map(emptyPair) } };
    case 'saq':
      return {
        type,
        payload: { marking_points: ids('m', 3).map(emptyMarkingPoint), model_answer: '' },
      };
  }
}

export function emptyQuestionDraft(type: QuestionType = 'sba'): QuestionDraft {
  return { ...emptyPayload(type), stem: emptyField(), explanation: emptyField(), difficulty: 2 };
}

/**
 * Switches a draft to another type, keeping the stem, explanation and difficulty. SBA and
 * multiple response share their options (an SBA keeps only the first correct one).
 */
export function changeQuestionType(draft: QuestionDraft, type: QuestionType): QuestionDraft {
  if (draft.type === type) return draft;
  const common = { stem: draft.stem, explanation: draft.explanation, difficulty: draft.difficulty };
  if (
    (draft.type === 'sba' || draft.type === 'multiple_response') &&
    (type === 'sba' || type === 'multiple_response')
  ) {
    let seen = false;
    const options = draft.payload.options.map((option) => {
      if (type === 'multiple_response' || !option.correct) return option;
      if (seen) return { ...option, correct: false };
      seen = true;
      return option;
    });
    return { ...common, type, payload: { options } } as QuestionDraft;
  }
  return { ...common, ...emptyPayload(type) };
}

/** Marks one SBA option as the correct one (the others become wrong). */
export function chooseSbaAnswer(options: readonly Choice[], id: string): Choice[] {
  return options.map((option) => ({ ...option, correct: option.id === id }));
}

// ---------------------------------------------------------------------------------------------
// Fill in the blank: the text marks each blank as {{id}}

export type BlankPart = { type: 'text'; text: string } | { type: 'blank'; id: string };

const BLANK_PATTERN = /\{\{(\d{1,2})\}\}/g;

/** Splits fill-in text into plain text and blanks. */
export function parseBlankText(text: string): BlankPart[] {
  const parts: BlankPart[] = [];
  let last = 0;
  for (const match of text.matchAll(BLANK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', text: text.slice(last, start) });
    parts.push({ type: 'blank', id: match[1] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts;
}

/** The blank ids in the order they appear, each once. */
export function blankIdsInText(text: string): string[] {
  const seen: string[] = [];
  for (const part of parseBlankText(text)) {
    if (part.type === 'blank' && !seen.includes(part.id)) seen.push(part.id);
  }
  return seen;
}

/** The text with each blank shown as "___" (for previews and search). */
export function blankPlainText(text: string): string {
  return parseBlankText(text)
    .map((part) => (part.type === 'text' ? part.text : '___'))
    .join('');
}

export const BLANKS_MAX = 20;

/**
 * Turns the selected words into a blank: they are replaced by `{{n}}` and become the blank's
 * first accepted answer. With nothing selected, an empty blank goes in at the cursor. The cursor
 * ends up just after the new blank.
 */
export function makeBlank(
  text: string,
  blanks: readonly Blank[],
  selection: TextSelection,
): { text: string; blanks: Blank[]; selection: TextSelection } {
  const start = Math.max(0, Math.min(selection.start, selection.end, text.length));
  const end = Math.min(text.length, Math.max(selection.start, selection.end));
  const used = [...blanks.map((b) => b.id), ...blankIdsInText(text)].map(Number);
  const id = String(Math.max(0, ...used.filter(Number.isInteger)) + 1);
  const selected = text.slice(start, end);
  // Keep the spaces around the words outside the blank.
  const answer = selected.trim();
  const leading = selected.slice(0, selected.length - selected.trimStart().length);
  const trailing = selected.slice(selected.trimEnd().length);
  const marker = `{{${id}}}`;
  const inserted = `${leading}${marker}${trailing}`;
  const nextText = text.slice(0, start) + inserted + text.slice(end);
  const cursor = start + leading.length + marker.length;
  return {
    text: nextText,
    blanks: [...blanks, { id, answers: answer ? [answer] : [] }],
    selection: { start: cursor, end: cursor },
  };
}

/**
 * The blanks a text uses, in the order they appear: kept answers for blanks still in the text,
 * an empty entry for a marker typed by hand, and nothing for blanks whose marker was deleted.
 */
export function syncBlanks(text: string, blanks: readonly Blank[]): Blank[] {
  const byId = new Map(blanks.map((b) => [b.id, b]));
  return blankIdsInText(text).map((id) => byId.get(id) ?? { id, answers: [] });
}

/** A blank's accepted answers as the editor shows them: one per line. */
export function answersToLines(answers: readonly string[]): string {
  return answers.join('\n');
}

/** Lines typed in the editor back to answers: trimmed, no empty lines, no repeats (any case). */
export function linesToAnswers(lines: string): string[] {
  const answers: string[] = [];
  const seen = new Set<string>();
  for (const line of lines.split(/\r?\n/)) {
    const answer = line.trim().replace(/\s+/g, ' ');
    const key = answer.toLowerCase();
    if (answer && !seen.has(key)) {
      seen.add(key);
      answers.push(answer);
    }
  }
  return answers;
}

// ---------------------------------------------------------------------------------------------
// Checking and saving a question

/**
 * Removes what can't matter: spaces around text, rows left completely empty (an option with no
 * text, no rationale and not marked correct), blanks whose marker was deleted, repeated answers.
 */
export function tidyQuestionDraft(draft: QuestionDraft): QuestionDraft {
  const common = {
    stem: tidyField(draft.stem),
    explanation: tidyField(draft.explanation),
    difficulty: draft.difficulty,
  };
  switch (draft.type) {
    case 'sba':
    case 'multiple_response': {
      const options = draft.payload.options
        .map((o) => ({ ...o, text: o.text.trim(), why: o.why.trim() }))
        .filter((o) => o.text || o.why || o.correct);
      return { ...common, type: draft.type, payload: { options } } as QuestionDraft;
    }
    case 'mtf': {
      const statements = draft.payload.statements
        .map((st) => ({ ...st, text: st.text.trim(), why: st.why.trim() }))
        .filter((st) => st.text || st.why);
      return { ...common, type: 'mtf', payload: { statements } };
    }
    case 'fill_blank': {
      const text = draft.payload.text.trim();
      const blanks = syncBlanks(text, draft.payload.blanks).map((b) => ({
        id: b.id,
        answers: linesToAnswers(b.answers.join('\n')),
      }));
      return { ...common, type: 'fill_blank', payload: { text, blanks } };
    }
    case 'matching': {
      const pairs = draft.payload.pairs
        .map((p) => ({ ...p, left: p.left.trim(), right: p.right.trim() }))
        .filter((p) => p.left || p.right);
      return { ...common, type: 'matching', payload: { pairs } };
    }
    case 'saq': {
      const points = draft.payload.marking_points
        .map((m) => ({ ...m, text: m.text.trim() }))
        .filter((m) => m.text);
      return {
        ...common,
        type: 'saq',
        payload: { marking_points: points, model_answer: draft.payload.model_answer.trim() },
      };
    }
  }
}

function tidyField(field: CardField): CardField {
  return { text: field.text.replace(/\s+$/, '').replace(/^\s*\n/, ''), mediaIds: field.mediaIds };
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
export const MAX_STATEMENTS = 10;
export const MIN_PAIRS = 2;
export const MAX_PAIRS = 12;
export const MAX_MARKING_POINTS = 20;

export type QuestionProblem =
  | 'stemEmpty'
  | 'tooLong'
  | 'tooManyImages'
  | 'tooFewOptions'
  | 'optionEmpty'
  | 'oneCorrect'
  | 'noCorrect'
  | 'noStatements'
  | 'statementEmpty'
  | 'blankTextEmpty'
  | 'noBlanks'
  | 'blankNoAnswer'
  | 'tooManyBlanks'
  | 'tooFewPairs'
  | 'pairEmpty'
  | 'duplicateLeft'
  | 'noMarkingPoints';

/** Why a question can't be saved yet, or null when it can. Checks the tidied draft. */
export function questionDraftProblem(input: QuestionDraft): QuestionProblem | null {
  const draft = tidyQuestionDraft(input);
  const fields = [draft.stem, draft.explanation];
  if (fields.some((f) => f.text.length > FIELD_TEXT_MAX)) return 'tooLong';
  if (fields.some((f) => f.mediaIds.length > FIELD_IMAGES_MAX)) return 'tooManyImages';
  // A fill-in question can be just its text with blanks; every other type needs a stem.
  if (draft.type !== 'fill_blank' && isFieldEmpty(draft.stem)) return 'stemEmpty';
  switch (draft.type) {
    case 'sba':
    case 'multiple_response': {
      const { options } = draft.payload;
      if (options.length < MIN_OPTIONS) return 'tooFewOptions';
      if (options.some((o) => !o.text)) return 'optionEmpty';
      const correct = options.filter((o) => o.correct).length;
      if (draft.type === 'sba' && correct !== 1) return 'oneCorrect';
      if (correct === 0) return 'noCorrect';
      return null;
    }
    case 'mtf': {
      const { statements } = draft.payload;
      if (statements.length === 0) return 'noStatements';
      if (statements.some((st) => !st.text)) return 'statementEmpty';
      return null;
    }
    case 'fill_blank': {
      const { text, blanks } = draft.payload;
      if (!text) return 'blankTextEmpty';
      if (blanks.length === 0) return 'noBlanks';
      if (blanks.length > BLANKS_MAX) return 'tooManyBlanks';
      if (blanks.some((b) => b.answers.length === 0)) return 'blankNoAnswer';
      return null;
    }
    case 'matching': {
      const { pairs } = draft.payload;
      if (pairs.length < MIN_PAIRS) return 'tooFewPairs';
      if (pairs.some((p) => !p.left || !p.right)) return 'pairEmpty';
      const lefts = pairs.map((p) => p.left.toLowerCase());
      if (new Set(lefts).size !== lefts.length) return 'duplicateLeft';
      return null;
    }
    case 'saq':
      if (draft.payload.marking_points.length === 0) return 'noMarkingPoints';
      return null;
  }
}

/** Plain text of a question for lists and search: the stem, or the fill-in text with ___. */
export function questionPlainText(draft: QuestionDraft): string {
  const stem = draft.stem.text.trim();
  if (draft.type !== 'fill_blank') return stem;
  const sentence = blankPlainText(draft.payload.text.trim());
  return stem && sentence ? `${stem}\n${sentence}` : stem || sentence;
}

/** What gets saved for a question. */
export function summariseQuestion(input: QuestionDraft): {
  type: QuestionType;
  stemJson: string;
  stemText: string;
  payloadJson: string;
  explanationJson: string | null;
  difficulty: Difficulty;
} {
  const draft = tidyQuestionDraft(input);
  return {
    type: draft.type,
    stemJson: JSON.stringify(fieldToDoc(draft.stem)),
    stemText: questionPlainText(draft),
    payloadJson: JSON.stringify(draft.payload),
    explanationJson: isFieldEmpty(draft.explanation)
      ? null
      : JSON.stringify(fieldToDoc(draft.explanation)),
    difficulty: draft.difficulty,
  };
}

/** A saved question back in the editor's shape. Null if its type or payload can't be read. */
export function questionToDraft(row: {
  type: string;
  stemJson: string;
  payloadJson: string;
  explanationJson: string | null;
  difficulty: number;
}): QuestionDraft | null {
  if (!isQuestionType(row.type)) return null;
  const typed = parsePayload(row.type, row.payloadJson);
  if (!typed) return null;
  const difficulty = difficulties.includes(row.difficulty as Difficulty)
    ? (row.difficulty as Difficulty)
    : 2;
  return {
    ...typed,
    stem: docToField(row.stemJson),
    explanation: docToField(row.explanationJson),
    difficulty,
  };
}

/** Every image a question uses once saved (so images added and then dropped can be cleaned up). */
export function questionMediaIds(draft: QuestionDraft): string[] {
  return [...draft.stem.mediaIds, ...draft.explanation.mediaIds];
}

/** The first non-empty line of a question's plain text, for one-line lists. */
export function questionPreview(stemText: string): string {
  return (
    stemText
      .split('\n')
      .find((line) => line.trim() !== '')
      ?.trim() ?? ''
  );
}

/** Bank search: every typed word must appear in the question's text (any case); optional type. */
export function filterQuestions<T extends { stemText: string; type: string }>(
  questions: readonly T[],
  query: string,
  type: QuestionType | null = null,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return questions.filter((q) => {
    if (type && q.type !== type) return false;
    const text = q.stemText.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

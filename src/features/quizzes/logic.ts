import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';

import { questionTypes, type QuestionType } from '@/db/schema';
import {
  docToField,
  emptyField,
  FIELD_IMAGES_MAX,
  FIELD_TEXT_MAX,
  fieldToDoc,
  isFieldEmpty,
  type CardDraft,
  type CardField,
  type TextSelection,
} from '@/features/decks/logic';
import { answerKey, editDistance, shuffle } from '@/features/review/logic';
import { DEFAULT_TIMEZONE } from '@/lib/time';

import {
  parsePayload,
  parseQuizSettings,
  type Blank,
  type FillBlankResponse,
  type MatchingResponse,
  type MtfResponse,
  type MultipleResponseResponse,
  type QuestionResponseValue,
  type ResponseFor,
  type SaqResponse,
  type SbaResponse,
  type Choice,
  type MarkingPoint,
  type Pair,
  type QuizMode,
  type QuizSettings,
  type Statement,
  type TypedPayload,
} from './types';

// Pure rules for the question bank, the quiz builder and the quiz player (PRODUCT_SPEC §4.3):
// question drafts for each type, checking a question before saving, fill-in-the-blank markers,
// points, quiz titles and settings, and (task 1.11) scoring answers, building an attempt's
// results and turning questions into flashcards. No React and no database, so all of it is
// unit-tested.

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

// ---------------------------------------------------------------------------------------------
// Scoring (ARCHITECTURE §7.6): one scorer per type, `score(question, response, settings)`

/**
 * How one item of a question (an option, statement, blank, pair or marking point) went:
 * right · wrong · close (a fill-in accepted with one typing slip) · missed (a correct option or
 * marking point the student didn't pick) · blank (not answered) · neutral (a wrong option left
 * alone, nothing to show).
 */
export type ItemResult = 'right' | 'wrong' | 'close' | 'missed' | 'blank' | 'neutral';

export type ScoreResult = {
  /** Marks earned (can be below 0 for MTF with negative marking). */
  score: number;
  /** Marks available. */
  max: number;
  /** Everything right (full marks). */
  isCorrect: boolean;
  /** False when the student gave no answer at all. */
  answered: boolean;
  /** item id → how it went. */
  items: Record<string, ItemResult>;
};

export type ScoringSettings = Pick<QuizSettings, 'negativeMarking'>;

/** A question's type, payload and the student's response (null = not answered). */
export type ScorableQuestion = {
  [T in QuestionType]: {
    type: T;
    payload: Extract<TypedPayload, { type: T }>['payload'];
    response: ResponseFor<T> | null;
  };
}[QuestionType];

function result(score: number, max: number, items: Record<string, ItemResult>, answered: boolean) {
  return { score, max, isCorrect: max > 0 && score === max, answered, items };
}

function scoreChoices(
  options: readonly Choice[],
  chosen: readonly string[],
  single: boolean,
): ScoreResult {
  const picked = new Set(chosen.filter((id) => options.some((o) => o.id === id)));
  const items: Record<string, ItemResult> = {};
  let right = 0;
  let wrong = 0;
  for (const option of options) {
    const isPicked = picked.has(option.id);
    if (isPicked && option.correct) right += 1;
    if (isPicked && !option.correct) wrong += 1;
    items[option.id] = isPicked
      ? option.correct
        ? 'right'
        : 'wrong'
      : option.correct
        ? 'missed'
        : 'neutral';
  }
  const answered = picked.size > 0;
  if (single) return result(right === 1 && wrong === 0 ? 1 : 0, 1, items, answered);
  // Multiple response: +1 for each correct option picked, −1 for each wrong one, never below 0.
  const max = options.filter((o) => o.correct).length;
  return result(Math.max(0, right - wrong), max, items, answered);
}

/** SBA: 1 for the correct option, 0 otherwise. */
export function scoreSba(options: readonly Choice[], response: SbaResponse | null): ScoreResult {
  return scoreChoices(options, response?.choice ? [response.choice] : [], true);
}

/** Multiple response: partial credit, +1 per correct option picked, −1 per wrong one, floor 0. */
export function scoreMultipleResponse(
  options: readonly Choice[],
  response: MultipleResponseResponse | null,
): ScoreResult {
  return scoreChoices(options, response?.choices ?? [], false);
}

/**
 * MTF: per statement +1 right, 0 unanswered, and 0 or −1 wrong (negative marking). The question
 * can go below 0 with negative marking — that's what stops guessing paying off.
 */
export function scoreMtf(
  statements: readonly Statement[],
  response: MtfResponse | null,
  settings: ScoringSettings,
): ScoreResult {
  const answers = response?.answers ?? {};
  const items: Record<string, ItemResult> = {};
  let score = 0;
  let answered = false;
  for (const statement of statements) {
    const given = answers[statement.id];
    if (given === undefined) {
      items[statement.id] = 'blank';
      continue;
    }
    answered = true;
    if (given === statement.answer) {
      items[statement.id] = 'right';
      score += 1;
    } else {
      items[statement.id] = 'wrong';
      if (settings.negativeMarking) score -= 1;
    }
  }
  return result(score, statements.length, items, answered);
}

/** Fill-ins this long (letters and digits) or longer forgive one typing slip. */
export const FILL_SLIP_MIN_LENGTH = 6;

/**
 * Checks one blank. Capitals, spaces, punctuation and accents don't matter, and Greek letters
 * match their names ("β" = "beta"). An answer of 6+ characters with one slip (a letter added,
 * missed or swapped) is 'close' and still counts. Answers with a number in them must be exact,
 * so "120" never passes for "125".
 */
export function checkBlank(accepted: readonly string[], typed: string): ItemResult {
  const typedKey = answerKey(typed);
  if (!typedKey) return 'blank';
  const keys = accepted.map(answerKey).filter(Boolean);
  if (keys.includes(typedKey)) return 'right';
  const close = keys.some(
    (key) =>
      !/\d/.test(key) &&
      !/\d/.test(typedKey) &&
      key.length >= FILL_SLIP_MIN_LENGTH &&
      editDistance(key, typedKey) <= 1,
  );
  return close ? 'close' : 'wrong';
}

/** Fill in the blank: +1 per blank right (or close). */
export function scoreFillBlank(
  blanks: readonly Blank[],
  response: FillBlankResponse | null,
): ScoreResult {
  const typed = response?.blanks ?? {};
  const items: Record<string, ItemResult> = {};
  let score = 0;
  for (const blank of blanks) {
    const verdict = checkBlank(blank.answers, typed[blank.id] ?? '');
    items[blank.id] = verdict;
    if (verdict === 'right' || verdict === 'close') score += 1;
  }
  const answered = blanks.some((b) => (typed[b.id] ?? '').trim() !== '');
  return result(score, blanks.length, items, answered);
}

/** Matching: +1 per left item matched to its right-hand text (the same text counts anywhere). */
export function scoreMatching(
  pairs: readonly Pair[],
  response: MatchingResponse | null,
): ScoreResult {
  const matches = response?.matches ?? {};
  const items: Record<string, ItemResult> = {};
  let score = 0;
  let answered = false;
  for (const pair of pairs) {
    const picked = matches[pair.id];
    if (picked === undefined || picked === '') {
      items[pair.id] = 'blank';
      continue;
    }
    answered = true;
    if (sameText(picked, pair.right)) {
      items[pair.id] = 'right';
      score += 1;
    } else items[pair.id] = 'wrong';
  }
  return result(score, pairs.length, items, answered);
}

const sameText = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/** SAQ: self-marked, one mark per marking point the student ticked. */
export function scoreSaq(
  points: readonly MarkingPoint[],
  response: SaqResponse | null,
): ScoreResult {
  const ticked = new Set(response?.ticked ?? []);
  const items: Record<string, ItemResult> = {};
  let score = 0;
  for (const point of points) {
    if (ticked.has(point.id)) {
      items[point.id] = 'right';
      score += 1;
    } else items[point.id] = 'missed';
  }
  const answered = (response?.text.trim() ?? '') !== '' || score > 0;
  return result(score, points.length, items, answered);
}

/** Scores any question with the scorer for its type. */
export function scoreQuestion(question: ScorableQuestion, settings: ScoringSettings): ScoreResult {
  switch (question.type) {
    case 'sba':
      return scoreSba(question.payload.options, question.response);
    case 'multiple_response':
      return scoreMultipleResponse(question.payload.options, question.response);
    case 'mtf':
      return scoreMtf(question.payload.statements, question.response, settings);
    case 'fill_blank':
      return scoreFillBlank(question.payload.blanks, question.response);
    case 'matching':
      return scoreMatching(question.payload.pairs, question.response);
    case 'saq':
      return scoreSaq(question.payload.marking_points, question.response);
  }
}

/** Pairs a question with a response, checking the response fits its type. */
export function scorable(question: TypedPayload, response: QuestionResponseValue | null) {
  return { ...question, response } as ScorableQuestion;
}

/** A scorer result scaled to the points the question is worth in the quiz, to 2 decimals. */
export function scaleToPoints(score: number, max: number, points: number): number {
  if (max <= 0) return 0;
  return Math.round((score / max) * points * 100) / 100;
}

/** right: full marks · partial: some marks · wrong: none (or below). */
export type QuestionVerdict = 'right' | 'partial' | 'wrong';

export function questionVerdict(res: Pick<ScoreResult, 'score' | 'isCorrect'>): QuestionVerdict {
  if (res.isCorrect) return 'right';
  return res.score > 0 ? 'partial' : 'wrong';
}

// ---------------------------------------------------------------------------------------------
// Taking a quiz

/** One question as the player shows it: the quiz's points, and the order of its options. */
export type PlayItem = {
  questionId: string;
  points: number;
  question: QuestionDraft;
  /** SBA / multiple response: option ids in the order shown. */
  optionOrder: string[];
  /** Matching: the distinct right-hand texts in the order shown. */
  matchChoices: string[];
};

/** The distinct right-hand texts of a matching question (any case counts as the same). */
export function distinctRights(pairs: readonly Pair[]): string[] {
  const seen: string[] = [];
  for (const pair of pairs) {
    if (!seen.some((text) => sameText(text, pair.right))) seen.push(pair.right);
  }
  return seen;
}

/**
 * The questions in the order the player shows them: shuffled if the quiz says so, options too.
 * Matching choices are always shuffled (in order they would give the answer away). Pass `random`
 * in tests for a fixed order.
 */
export function buildPlayItems(
  rows: readonly { questionId: string; points: number; question: QuestionDraft }[],
  settings: Pick<QuizSettings, 'shuffleQuestions' | 'shuffleOptions'>,
  random: () => number = Math.random,
): PlayItem[] {
  const ordered = settings.shuffleQuestions ? shuffle(rows, random) : [...rows];
  return ordered.map((row) => {
    const { question } = row;
    let optionOrder: string[] = [];
    let matchChoices: string[] = [];
    if (question.type === 'sba' || question.type === 'multiple_response') {
      optionOrder = question.payload.options.map((o) => o.id);
      if (settings.shuffleOptions) optionOrder = shuffle(optionOrder, random);
    }
    if (question.type === 'matching') {
      matchChoices = shuffle(distinctRights(question.payload.pairs), random);
    }
    return { ...row, optionOrder, matchChoices };
  });
}

/** An empty response for a question, ready to fill in. */
export function emptyResponse(type: QuestionType): QuestionResponseValue {
  switch (type) {
    case 'sba':
      return { choice: null };
    case 'multiple_response':
      return { choices: [] };
    case 'mtf':
      return { answers: {} };
    case 'fill_blank':
      return { blanks: {} };
    case 'matching':
      return { matches: {} };
    case 'saq':
      return { text: '', ticked: [], marked: false };
  }
}

/** Whether the student has given any answer (the navigator grid shows it). */
export function isAnswered(item: PlayItem, response: QuestionResponseValue | null): boolean {
  if (!response) return false;
  return scoreQuestion(scorable(item.question, response), { negativeMarking: false }).answered;
}

/** SBA / multiple response: pick or unpick an option. SBA keeps one; tapping it again clears it. */
export function toggleChoice(
  type: 'sba' | 'multiple_response',
  response: QuestionResponseValue | null,
  optionId: string,
): QuestionResponseValue {
  if (type === 'sba') {
    const current = (response as SbaResponse | null)?.choice ?? null;
    return { choice: current === optionId ? null : optionId };
  }
  const choices = (response as MultipleResponseResponse | null)?.choices ?? [];
  return {
    choices: choices.includes(optionId)
      ? choices.filter((id) => id !== optionId)
      : [...choices, optionId],
  };
}

/** MTF: set a statement true or false; picking the same answer again clears it. */
export function setStatementAnswer(
  response: MtfResponse | null,
  statementId: string,
  answer: boolean,
): MtfResponse {
  const answers = { ...(response?.answers ?? {}) };
  if (answers[statementId] === answer) delete answers[statementId];
  else answers[statementId] = answer;
  return { answers };
}

/** Matching: pick a right-hand text for a left item (null clears it). */
export function setMatch(
  response: MatchingResponse | null,
  pairId: string,
  right: string | null,
): MatchingResponse {
  const matches = { ...(response?.matches ?? {}) };
  if (right === null) delete matches[pairId];
  else matches[pairId] = right;
  return { matches };
}

/** SAQ: tick or untick a marking point. */
export function toggleMarkingPoint(response: SaqResponse | null, pointId: string): SaqResponse {
  const current = response ?? { text: '', ticked: [], marked: false };
  const ticked = current.ticked.includes(pointId)
    ? current.ticked.filter((id) => id !== pointId)
    : [...current.ticked, pointId];
  return { ...current, ticked };
}

/** The questions in an exam the student still has to self-mark (written SAQs). */
export function unmarkedSaqs(
  items: readonly PlayItem[],
  responses: Readonly<Record<string, QuestionResponseValue | null>>,
): PlayItem[] {
  return items.filter((item) => {
    if (item.question.type !== 'saq') return false;
    const response = responses[item.questionId] as SaqResponse | null | undefined;
    return !response?.marked;
  });
}

/** Seconds left in a timed exam (never below 0). */
export function secondsLeft(startedAtMs: number, limitSec: number, nowMs: number): number {
  return Math.max(0, Math.ceil(limitSec - (nowMs - startedAtMs) / 1000));
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Under this many seconds the exam timer warns (words as well as colour). */
export const TIMER_WARNING_SEC = 60;

// ---------------------------------------------------------------------------------------------
// Results

export type ResponseResult = {
  questionId: string;
  position: number;
  /** In quiz points. */
  score: number;
  maxScore: number;
  isCorrect: boolean;
  responseJson: string | null;
  timeMs: number;
  flagged: boolean;
};

export type AttemptResult = {
  responses: ResponseResult[];
  /** In quiz points; never below 0 overall. */
  score: number;
  maxScore: number;
};

/** Scores every question of an attempt and adds up the points. */
export function buildAttemptResult(
  items: readonly PlayItem[],
  responses: Readonly<Record<string, QuestionResponseValue | null>>,
  settings: ScoringSettings,
  extras: {
    timeMs?: Readonly<Record<string, number>>;
    flagged?: Readonly<Record<string, boolean>>;
  } = {},
): AttemptResult {
  const rows = items.map((item, position): ResponseResult => {
    const response = responses[item.questionId] ?? null;
    const scored = scoreQuestion(scorable(item.question, response), settings);
    return {
      questionId: item.questionId,
      position,
      score: scaleToPoints(scored.score, scored.max, item.points),
      maxScore: item.points,
      isCorrect: scored.isCorrect,
      responseJson: response && scored.answered ? JSON.stringify(response) : null,
      timeMs: Math.max(0, Math.round(extras.timeMs?.[item.questionId] ?? 0)),
      flagged: extras.flagged?.[item.questionId] ?? false,
    };
  });
  const total = rows.reduce((sum, r) => sum + r.score, 0);
  return {
    responses: rows,
    score: Math.max(0, Math.round(total * 100) / 100),
    maxScore: rows.reduce((sum, r) => sum + r.maxScore, 0),
  };
}

export type AttemptSummary = {
  score: number;
  maxScore: number;
  /** 0–100, whole number. */
  percent: number;
  passed: boolean;
  questions: number;
  correct: number;
  /** Questions not fully right (what "Retry wrong only" takes). */
  wrong: number;
  timeMs: number;
};

/** An attempt's score as a whole-number percent (0 when it had no points). */
export function attemptPercent(attempt: { score: number; maxScore: number }): number {
  return attempt.maxScore > 0
    ? Math.round((Math.max(0, attempt.score) / attempt.maxScore) * 100)
    : 0;
}

export function summariseAttempt(
  attempt: { score: number; maxScore: number; startedAt: string; finishedAt: string | null },
  responses: readonly { isCorrect: boolean }[],
  passMark: number,
): AttemptSummary {
  const percent = attemptPercent(attempt);
  const correct = responses.filter((r) => r.isCorrect).length;
  const timeMs = attempt.finishedAt
    ? Math.max(0, Date.parse(attempt.finishedAt) - Date.parse(attempt.startedAt))
    : 0;
  return {
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent,
    passed: percent >= passMark,
    questions: responses.length,
    correct,
    wrong: responses.length - correct,
    timeMs,
  };
}

/** When an attempt finished, in the student's timezone, e.g. "25 Oct, 14:05". */
export function formatAttemptTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(iso, timeZone, 'd MMM, HH:mm');
}

/** Points for display: whole numbers as they are, others to 1 decimal ("2.5"). */
export function formatPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Dozi's mood on the results screen: always warm, a hard quiz gets encouragement. */
export function resultsMood(percent: number): 'celebrating' | 'proud' | 'happy' | 'encouraging' {
  if (percent >= 90) return 'celebrating';
  if (percent >= 70) return 'proud';
  if (percent >= 50) return 'happy';
  return 'encouraging';
}

// ---------------------------------------------------------------------------------------------
// "Add wrong ones to flashcards"

export type CardLabels = {
  true: string;
  false: string;
  chooseAll: string;
  modelAnswer: string;
};

const clip = (text: string) => text.slice(0, FIELD_TEXT_MAX);

const joinLines = (...parts: string[]) =>
  parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n');

/**
 * A flashcard made from a question: fill-in-the-blank becomes a cloze card (each blank a cloze,
 * its first accepted answer the answer), every other type a basic card with the options on the
 * front and the answer on the back. The explanation goes in "Extra"; images stay where they were.
 */
export function questionToCard(draft: QuestionDraft, labels: CardLabels): CardDraft {
  const stem = draft.stem.text.trim();
  const extra: CardField = {
    text: clip(draft.explanation.text.trim()),
    mediaIds: draft.explanation.mediaIds,
  };
  const basic = (front: string, back: string): CardDraft => ({
    type: 'basic',
    front: { text: clip(front), mediaIds: draft.stem.mediaIds },
    back: { text: clip(back), mediaIds: [] },
    extra,
  });
  const letter = (index: number) => String.fromCharCode(65 + index);

  switch (draft.type) {
    case 'sba':
    case 'multiple_response': {
      const { options } = draft.payload;
      const front = joinLines(
        stem,
        draft.type === 'multiple_response' ? labels.chooseAll : '',
        options.map((o, i) => `${letter(i)}. ${o.text}`).join('\n'),
      );
      const back = options
        .map((o, i) => (o.correct ? joinLines(`${letter(i)}. ${o.text}`, o.why) : ''))
        .filter(Boolean)
        .join('\n');
      return basic(front, back);
    }
    case 'mtf': {
      const { statements } = draft.payload;
      const front = joinLines(stem, statements.map((st, i) => `${i + 1}. ${st.text}`).join('\n'));
      const back = statements
        .map((st, i) => joinLines(`${i + 1}. ${st.answer ? labels.true : labels.false}`, st.why))
        .join('\n');
      return basic(front, back);
    }
    case 'fill_blank': {
      const order = blankIdsInText(draft.payload.text);
      const byId = new Map(draft.payload.blanks.map((b) => [b.id, b]));
      const cloze = parseBlankText(draft.payload.text)
        .map((part) => {
          if (part.type === 'text') return part.text;
          const answer = byId.get(part.id)?.answers[0] ?? '';
          return `{{c${order.indexOf(part.id) + 1}::${answer}}}`;
        })
        .join('');
      return {
        type: 'cloze',
        front: { text: clip(joinLines(stem, cloze)), mediaIds: draft.stem.mediaIds },
        back: emptyField(),
        extra,
      };
    }
    case 'matching': {
      const { pairs } = draft.payload;
      const front = joinLines(stem, pairs.map((p) => `• ${p.left}`).join('\n'));
      const back = pairs.map((p) => `${p.left} → ${p.right}`).join('\n');
      return basic(front, back);
    }
    case 'saq': {
      const back = joinLines(
        draft.payload.marking_points.map((m) => `• ${m.text}`).join('\n'),
        draft.payload.model_answer ? `${labels.modelAnswer}: ${draft.payload.model_answer}` : '',
      );
      return basic(stem, back);
    }
  }
}

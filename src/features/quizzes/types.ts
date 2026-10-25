import { z } from 'zod';

import type { QuestionType } from '@/db/schema';

// The shapes of `questions.payload_json` (one per question type) and `quizzes.settings_json`
// (ARCHITECTURE §3.3). This file is the source of truth for both, also for official content
// (CONTENT_GUIDE §5.4). These schemas check the *shape* of saved JSON; whether a question is
// complete enough to save (one correct option, no empty blanks…) is `questionDraftProblem` in
// `logic.ts`, so a half-written draft can still be held in the editor.

/** Short ids inside a question (`o1`, `s2`, `p3`, `m4`, blank `1`): stable when items move. */
const itemId = z.string().min(1).max(12);

export const OPTION_TEXT_MAX = 500;
export const RATIONALE_MAX = 1000;
export const BLANK_ANSWER_MAX = 100;
export const BLANK_TEXT_MAX = 2000;
export const MATCH_TEXT_MAX = 200;
export const MARKING_POINT_MAX = 500;
export const MODEL_ANSWER_MAX = 5000;

/** An SBA or multiple-response option, with why it is right or wrong. */
export const choiceSchema = z.object({
  id: itemId,
  text: z.string().max(OPTION_TEXT_MAX),
  correct: z.boolean(),
  why: z.string().max(RATIONALE_MAX),
});
export type Choice = z.infer<typeof choiceSchema>;

/** One MTF statement: true or false, with why. */
export const statementSchema = z.object({
  id: itemId,
  text: z.string().max(OPTION_TEXT_MAX),
  answer: z.boolean(),
  why: z.string().max(RATIONALE_MAX),
});
export type Statement = z.infer<typeof statementSchema>;

/** One blank in a fill-in-the-blank text: every answer that counts as right. */
export const blankSchema = z.object({
  id: itemId,
  answers: z.array(z.string().max(BLANK_ANSWER_MAX)).max(20),
});
export type Blank = z.infer<typeof blankSchema>;

/** A left item and the right item it matches (e.g. a drug and its class). */
export const pairSchema = z.object({
  id: itemId,
  left: z.string().max(MATCH_TEXT_MAX),
  right: z.string().max(MATCH_TEXT_MAX),
});
export type Pair = z.infer<typeof pairSchema>;

export const markingPointSchema = z.object({
  id: itemId,
  text: z.string().max(MARKING_POINT_MAX),
});
export type MarkingPoint = z.infer<typeof markingPointSchema>;

export const sbaPayloadSchema = z.object({ options: z.array(choiceSchema).max(8) });
export const multipleResponsePayloadSchema = z.object({ options: z.array(choiceSchema).max(8) });
export const mtfPayloadSchema = z.object({ statements: z.array(statementSchema).max(10) });
/** `text` marks each blank as `{{id}}`, e.g. "Water boils at {{1}} °C at sea level." */
export const fillBlankPayloadSchema = z.object({
  text: z.string().max(BLANK_TEXT_MAX),
  blanks: z.array(blankSchema).max(20),
});
export const matchingPayloadSchema = z.object({ pairs: z.array(pairSchema).max(12) });
export const saqPayloadSchema = z.object({
  marking_points: z.array(markingPointSchema).max(20),
  model_answer: z.string().max(MODEL_ANSWER_MAX),
});

export type SbaPayload = z.infer<typeof sbaPayloadSchema>;
export type MultipleResponsePayload = z.infer<typeof multipleResponsePayloadSchema>;
export type MtfPayload = z.infer<typeof mtfPayloadSchema>;
export type FillBlankPayload = z.infer<typeof fillBlankPayloadSchema>;
export type MatchingPayload = z.infer<typeof matchingPayloadSchema>;
export type SaqPayload = z.infer<typeof saqPayloadSchema>;

/** A question's type together with its payload. */
export type TypedPayload =
  | { type: 'sba'; payload: SbaPayload }
  | { type: 'multiple_response'; payload: MultipleResponsePayload }
  | { type: 'mtf'; payload: MtfPayload }
  | { type: 'fill_blank'; payload: FillBlankPayload }
  | { type: 'matching'; payload: MatchingPayload }
  | { type: 'saq'; payload: SaqPayload };

export const payloadSchemas = {
  sba: sbaPayloadSchema,
  multiple_response: multipleResponsePayloadSchema,
  mtf: mtfPayloadSchema,
  fill_blank: fillBlankPayloadSchema,
  matching: matchingPayloadSchema,
  saq: saqPayloadSchema,
} satisfies Record<QuestionType, z.ZodType>;

/** Reads a saved payload for its type. Null when the JSON is broken or the wrong shape. */
export function parsePayload(type: QuestionType, json: string): TypedPayload | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const result = payloadSchemas[type].safeParse(value);
  if (!result.success) return null;
  return { type, payload: result.data } as TypedPayload;
}

// ---------------------------------------------------------------------------------------------
// Quiz settings (PRODUCT_SPEC §4.3)

export const quizModes = ['practice', 'exam'] as const;
export type QuizMode = (typeof quizModes)[number];

export const quizSettingsSchema = z.object({
  /** Practice: instant feedback with the explanation. Exam: timer, flags, submit at the end. */
  mode: z.enum(quizModes),
  /** Exam mode only; null = no time limit. */
  timeLimitSec: z
    .number()
    .int()
    .min(60)
    .max(6 * 60 * 60)
    .nullable(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  /** Percent of the points needed to pass. */
  passMark: z.number().int().min(0).max(100),
  /** MTF: a wrong statement takes a mark off (an unanswered one doesn't). */
  negativeMarking: z.boolean(),
});
export type QuizSettings = z.infer<typeof quizSettingsSchema>;

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  mode: 'practice',
  timeLimitSec: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  passMark: 50,
  negativeMarking: false,
};

/** Reads saved settings; anything missing or broken falls back to the defaults. */
export function parseQuizSettings(json: string | null | undefined): QuizSettings {
  if (!json) return { ...DEFAULT_QUIZ_SETTINGS };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ...DEFAULT_QUIZ_SETTINGS };
  }
  const merged = { ...DEFAULT_QUIZ_SETTINGS, ...(typeof value === 'object' ? value : {}) };
  const result = quizSettingsSchema.safeParse(merged);
  return result.success ? result.data : { ...DEFAULT_QUIZ_SETTINGS };
}

// ---------------------------------------------------------------------------------------------
// Responses (`question_responses.response_json`, task 1.11): what the student answered, by the
// item ids in the payload (so shuffling never changes what a response means).

const answerText = z.string().max(BLANK_TEXT_MAX);

export const sbaResponseSchema = z.object({ choice: itemId.nullable() });
export const multipleResponseResponseSchema = z.object({ choices: z.array(itemId).max(8) });
/** Statement id → the student's true/false. A statement left out wasn't answered. */
export const mtfResponseSchema = z.object({ answers: z.record(itemId, z.boolean()) });
/** Blank id → what was typed. */
export const fillBlankResponseSchema = z.object({ blanks: z.record(itemId, answerText) });
/** Pair id → the right-hand text picked for its left item. */
export const matchingResponseSchema = z.object({
  matches: z.record(itemId, z.string().max(MATCH_TEXT_MAX)),
});
/** The written answer, the marking points the student ticked, and whether they marked it yet. */
export const saqResponseSchema = z.object({
  text: z.string().max(MODEL_ANSWER_MAX),
  ticked: z.array(itemId).max(20),
  marked: z.boolean(),
});

export type SbaResponse = z.infer<typeof sbaResponseSchema>;
export type MultipleResponseResponse = z.infer<typeof multipleResponseResponseSchema>;
export type MtfResponse = z.infer<typeof mtfResponseSchema>;
export type FillBlankResponse = z.infer<typeof fillBlankResponseSchema>;
export type MatchingResponse = z.infer<typeof matchingResponseSchema>;
export type SaqResponse = z.infer<typeof saqResponseSchema>;

/** A response for each question type, matching `TypedPayload`. */
export type ResponseFor<T extends QuestionType> = {
  sba: SbaResponse;
  multiple_response: MultipleResponseResponse;
  mtf: MtfResponse;
  fill_blank: FillBlankResponse;
  matching: MatchingResponse;
  saq: SaqResponse;
}[T];

export type QuestionResponseValue = ResponseFor<QuestionType>;

export const responseSchemas = {
  sba: sbaResponseSchema,
  multiple_response: multipleResponseResponseSchema,
  mtf: mtfResponseSchema,
  fill_blank: fillBlankResponseSchema,
  matching: matchingResponseSchema,
  saq: saqResponseSchema,
} satisfies Record<QuestionType, z.ZodType>;

/** Reads a saved response for its type. Null when there is none or it's the wrong shape. */
export function parseResponse<T extends QuestionType>(
  type: T,
  json: string | null | undefined,
): ResponseFor<T> | null {
  if (!json) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const result = responseSchemas[type].safeParse(value);
  return result.success ? (result.data as ResponseFor<T>) : null;
}

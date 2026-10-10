import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { questions, quizQuestions, quizzes, type Question, type Quiz } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId as defaultNewId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import {
  cleanQuizTitle,
  defaultPoints,
  POINTS_LIMITS,
  questionDraftProblem,
  questionToDraft,
  QUIZ_DESCRIPTION_MAX,
  quizTitleProblem,
  summariseQuestion,
  type QuestionDraft,
} from './logic';
import { DEFAULT_QUIZ_SETTINGS, quizSettingsSchema, type QuizSettings } from './types';

// The question bank, quizzes and the questions in each quiz (ARCHITECTURE §3.3). Every change
// marks rows dirty for sync.

type Deps = { newId?: () => string; now?: () => string };
type NowDep = Pick<Deps, 'now'>;

const isoNow = () => nowIso();

// ---------------------------------------------------------------------------------------------
// Quizzes

/**
 * The Library's quiz rows: every live quiz of an owner with its number of questions. A query
 * (not a promise) so the Library can run it as a live query.
 */
export function quizListQuery(db: AppDatabase, ownerId: string) {
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      folderId: quizzes.folderId,
      pinned: quizzes.pinned,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
      // Written out by hand: inside a subquery Drizzle would leave the column names unqualified.
      questionCount: sql<number>`(select count(*) from "quiz_questions" as "l" join "questions" as "q" on "q"."id" = "l"."question_id" where "l"."quiz_id" = "quizzes"."id" and "l"."deleted_at" is null and "q"."deleted_at" is null)`,
    })
    .from(quizzes)
    .where(and(eq(quizzes.ownerId, ownerId), isNull(quizzes.deletedAt)));
}

/** Every live quiz of an owner, A–Z. */
export async function listQuizzes(db: AppDatabase, ownerId: string): Promise<Quiz[]> {
  return db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.ownerId, ownerId), isNull(quizzes.deletedAt)))
    .orderBy(asc(quizzes.title));
}

/** One quiz, including a deleted one (so its screen can say it's gone). */
export async function getQuiz(db: AppDatabase, id: string): Promise<Quiz | undefined> {
  const rows = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  return rows[0];
}

export type NewQuizInput = { ownerId: string; folderId?: string | null; title: string };

export async function createQuiz(
  db: AppDatabase,
  input: NewQuizInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Quiz> {
  if (quizTitleProblem(input.title)) throw new Error('A quiz needs a title');
  const timestamp = now();
  const [created] = await db
    .insert(quizzes)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      folderId: input.folderId ?? null,
      title: cleanQuizTitle(input.title),
      settingsJson: JSON.stringify(DEFAULT_QUIZ_SETTINGS),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

export async function renameQuiz(
  db: AppDatabase,
  id: string,
  title: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (quizTitleProblem(title)) throw new Error('A quiz needs a title');
  await db
    .update(quizzes)
    .set({ title: cleanQuizTitle(title), updatedAt: now(), dirty: true })
    .where(eq(quizzes.id, id));
}

export async function setQuizDescription(
  db: AppDatabase,
  id: string,
  description: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(quizzes)
    .set({
      description: description.trim().slice(0, QUIZ_DESCRIPTION_MAX),
      updatedAt: now(),
      dirty: true,
    })
    .where(eq(quizzes.id, id));
}

export async function updateQuizSettings(
  db: AppDatabase,
  id: string,
  settings: QuizSettings,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const checked = quizSettingsSchema.parse(settings);
  await db
    .update(quizzes)
    .set({ settingsJson: JSON.stringify(checked), updatedAt: now(), dirty: true })
    .where(eq(quizzes.id, id));
}

export async function setQuizPinned(
  db: AppDatabase,
  id: string,
  pinned: boolean,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db.update(quizzes).set({ pinned, updatedAt: now(), dirty: true }).where(eq(quizzes.id, id));
}

/** Moves a quiz into a Quizzes folder, or to the top level (null). */
export async function moveQuiz(
  db: AppDatabase,
  id: string,
  folderId: string | null,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  await db
    .update(quizzes)
    .set({ folderId, updatedAt: now(), dirty: true })
    .where(eq(quizzes.id, id));
}

/**
 * Soft-deletes quizzes with their question links, all with the same `deletedAt`. The questions
 * themselves stay in the bank.
 */
async function softDeleteQuizRows(db: AppDatabase, quizIds: string[], deletedAt: string) {
  if (quizIds.length === 0) return;
  const set = { deletedAt, updatedAt: deletedAt, dirty: true };
  await db
    .update(quizzes)
    .set(set)
    .where(and(inArray(quizzes.id, quizIds), isNull(quizzes.deletedAt)));
  await db
    .update(quizQuestions)
    .set(set)
    .where(and(inArray(quizQuestions.quizId, quizIds), isNull(quizQuestions.deletedAt)));
}

async function restoreQuizRows(
  db: AppDatabase,
  quizIds: string[],
  deletedAt: string,
  timestamp: string,
) {
  if (quizIds.length === 0) return;
  const set = { deletedAt: null, updatedAt: timestamp, dirty: true };
  await db
    .update(quizzes)
    .set(set)
    .where(and(inArray(quizzes.id, quizIds), eq(quizzes.deletedAt, deletedAt)));
  await db
    .update(quizQuestions)
    .set(set)
    .where(and(inArray(quizQuestions.quizId, quizIds), eq(quizQuestions.deletedAt, deletedAt)));
}

/** Soft-deletes a quiz (its questions stay in the bank). Returns the timestamp for undo. */
export async function deleteQuiz(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  await softDeleteQuizRows(db, [id], deletedAt);
  return deletedAt;
}

/** Undoes `deleteQuiz` (with no `deletedAt`, the quiz's latest delete). */
export async function restoreQuiz(
  db: AppDatabase,
  id: string,
  deletedAt?: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const when = deletedAt ?? (await getQuiz(db, id))?.deletedAt;
  if (!when) return;
  await restoreQuizRows(db, [id], when, now());
}

/** For the Library's folder delete: the quizzes in these folders. */
export async function deleteQuizzesInFolders(
  db: AppDatabase,
  folderIds: string[],
  deletedAt: string,
): Promise<void> {
  if (folderIds.length === 0) return;
  const rows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(inArray(quizzes.folderId, folderIds), isNull(quizzes.deletedAt)));
  await softDeleteQuizRows(
    db,
    rows.map((r) => r.id),
    deletedAt,
  );
}

/** Undoes `deleteQuizzesInFolders`. */
export async function restoreQuizzesInFolders(
  db: AppDatabase,
  folderIds: string[],
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (folderIds.length === 0) return;
  const rows = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(inArray(quizzes.folderId, folderIds), eq(quizzes.deletedAt, deletedAt)));
  await restoreQuizRows(
    db,
    rows.map((r) => r.id),
    deletedAt,
    now(),
  );
}

/**
 * Changing a quiz's questions (or one of them) counts as changing the quiz: it moves up in
 * "Recently changed", and live queries on `quizzes` (question counts, the builder) re-run.
 */
async function touchQuizzes(db: AppDatabase, quizIds: string[], timestamp: string) {
  if (quizIds.length === 0) return;
  await db
    .update(quizzes)
    .set({ updatedAt: timestamp, dirty: true })
    .where(inArray(quizzes.id, quizIds));
}

// ---------------------------------------------------------------------------------------------
// The question bank

/** Every live question of an owner, newest first. */
export async function listQuestions(db: AppDatabase, ownerId: string): Promise<Question[]> {
  return db
    .select()
    .from(questions)
    .where(and(eq(questions.ownerId, ownerId), isNull(questions.deletedAt)))
    .orderBy(desc(questions.updatedAt), asc(questions.id));
}

/** One question, including a deleted one. */
export async function getQuestion(db: AppDatabase, id: string): Promise<Question | undefined> {
  const rows = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  return rows[0];
}

function checkQuestion(draft: QuestionDraft) {
  const problem = questionDraftProblem(draft);
  if (problem) throw new Error(`The question can’t be saved yet (${problem})`);
}

export type NewQuestionInput = { ownerId: string; draft: QuestionDraft };

/** Saves a new question in the bank. */
export async function createQuestion(
  db: AppDatabase,
  input: NewQuestionInput,
  { newId = defaultNewId, now = isoNow }: Deps = {},
): Promise<Question> {
  checkQuestion(input.draft);
  const timestamp = now();
  const [created] = await db
    .insert(questions)
    .values({
      id: newId(),
      ownerId: input.ownerId,
      source: 'user',
      ...summariseQuestion(input.draft),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return created;
}

/** The live quizzes a question is in. */
export async function quizIdsUsingQuestion(db: AppDatabase, questionId: string): Promise<string[]> {
  const rows = await db
    .select({ quizId: quizQuestions.quizId })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizzes.id, quizQuestions.quizId))
    .where(
      and(
        eq(quizQuestions.questionId, questionId),
        isNull(quizQuestions.deletedAt),
        isNull(quizzes.deletedAt),
      ),
    );
  return rows.map((r) => r.quizId);
}

/** Saves an edited question. Every quiz it is in shows the change. */
export async function updateQuestion(
  db: AppDatabase,
  id: string,
  draft: QuestionDraft,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  checkQuestion(draft);
  const question = await getQuestion(db, id);
  if (!question || question.deletedAt) throw new Error('That question is no longer here');
  const timestamp = now();
  await db
    .update(questions)
    .set({ ...summariseQuestion(draft), updatedAt: timestamp, dirty: true })
    .where(eq(questions.id, id));
  await touchQuizzes(db, await quizIdsUsingQuestion(db, id), timestamp);
}

/**
 * Soft-deletes a question and takes it out of every quiz, with one timestamp so
 * `restoreQuestion` puts it back in those quizzes too.
 */
export async function deleteQuestion(
  db: AppDatabase,
  id: string,
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  const quizIds = await quizIdsUsingQuestion(db, id);
  const set = { deletedAt, updatedAt: deletedAt, dirty: true };
  await db
    .update(questions)
    .set(set)
    .where(and(eq(questions.id, id), isNull(questions.deletedAt)));
  await db
    .update(quizQuestions)
    .set(set)
    .where(and(eq(quizQuestions.questionId, id), isNull(quizQuestions.deletedAt)));
  await touchQuizzes(db, quizIds, deletedAt);
  return deletedAt;
}

/** Undoes `deleteQuestion`: the question and the quiz places deleted with it. */
export async function restoreQuestion(
  db: AppDatabase,
  id: string,
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  const set = { deletedAt: null, updatedAt: timestamp, dirty: true };
  await db
    .update(questions)
    .set(set)
    .where(and(eq(questions.id, id), eq(questions.deletedAt, deletedAt)));
  await db
    .update(quizQuestions)
    .set(set)
    .where(and(eq(quizQuestions.questionId, id), eq(quizQuestions.deletedAt, deletedAt)));
  await touchQuizzes(db, await quizIdsUsingQuestion(db, id), timestamp);
}

/** question id → how many live quizzes it is in, for the bank list. */
export async function questionQuizCounts(
  db: AppDatabase,
  ownerId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ questionId: quizQuestions.questionId, count: sql<number>`count(*)` })
    .from(quizQuestions)
    .innerJoin(quizzes, eq(quizzes.id, quizQuestions.quizId))
    .where(
      and(
        eq(quizQuestions.ownerId, ownerId),
        isNull(quizQuestions.deletedAt),
        isNull(quizzes.deletedAt),
      ),
    )
    .groupBy(quizQuestions.questionId);
  return new Map(rows.map((r) => [r.questionId, Number(r.count)]));
}

// ---------------------------------------------------------------------------------------------
// The questions in a quiz

export type QuizQuestionRow = {
  question: Question;
  position: number;
  points: number;
};

/** A quiz's live questions in quiz order. */
export async function listQuizQuestions(
  db: AppDatabase,
  quizId: string,
): Promise<QuizQuestionRow[]> {
  const rows = await db
    .select({
      question: questions,
      position: quizQuestions.position,
      points: quizQuestions.points,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(
      and(
        eq(quizQuestions.quizId, quizId),
        isNull(quizQuestions.deletedAt),
        isNull(questions.deletedAt),
      ),
    )
    .orderBy(asc(quizQuestions.position), asc(quizQuestions.createdAt));
  return rows;
}

/**
 * Adds bank questions to the end of a quiz, in the order given, each worth its default points.
 * A question already in the quiz is left where it is; one removed earlier gets its row back.
 */
export async function addQuestionsToQuiz(
  db: AppDatabase,
  quizId: string,
  questionIds: readonly string[],
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const quiz = await getQuiz(db, quizId);
  if (!quiz || quiz.deletedAt) throw new Error('That quiz is no longer here');
  if (questionIds.length === 0) return;
  const timestamp = now();
  const existing = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  const byQuestion = new Map(existing.map((row) => [row.questionId, row]));
  const live = existing.filter((row) => row.deletedAt === null);
  let position = live.reduce((max, row) => Math.max(max, row.position + 1), 0);
  const found = await db
    .select()
    .from(questions)
    .where(and(inArray(questions.id, [...questionIds]), isNull(questions.deletedAt)));
  const questionsById = new Map(found.map((q) => [q.id, q]));

  for (const questionId of new Set(questionIds)) {
    const question = questionsById.get(questionId);
    if (!question) continue;
    const row = byQuestion.get(questionId);
    if (row && row.deletedAt === null) continue;
    const draft = questionToDraft(question);
    const points = draft ? defaultPoints(draft) : 1;
    if (row) {
      await db
        .update(quizQuestions)
        .set({ deletedAt: null, position, points, updatedAt: timestamp, dirty: true })
        .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)));
    } else {
      await db.insert(quizQuestions).values({
        quizId,
        questionId,
        position,
        points,
        ownerId: quiz.ownerId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    position += 1;
  }
  await touchQuizzes(db, [quizId], timestamp);
}

/** Writes a new question to the bank and adds it to the end of a quiz ("create inline"). */
export async function createQuestionInQuiz(
  db: AppDatabase,
  input: NewQuestionInput & { quizId: string },
  deps: Deps = {},
): Promise<Question> {
  const quiz = await getQuiz(db, input.quizId);
  if (!quiz || quiz.deletedAt) throw new Error('That quiz is no longer here');
  const question = await createQuestion(db, input, deps);
  await addQuestionsToQuiz(db, input.quizId, [question.id], deps);
  return question;
}

/**
 * Takes a question out of a quiz (it stays in the bank). Returns the timestamp so
 * `restoreQuizQuestion` can put it back in the same place.
 */
export async function removeQuestionFromQuiz(
  db: AppDatabase,
  quizId: string,
  questionId: string,
  { now = isoNow }: NowDep = {},
): Promise<string> {
  const deletedAt = now();
  await db
    .update(quizQuestions)
    .set({ deletedAt, updatedAt: deletedAt, dirty: true })
    .where(
      and(
        eq(quizQuestions.quizId, quizId),
        eq(quizQuestions.questionId, questionId),
        isNull(quizQuestions.deletedAt),
      ),
    );
  await touchQuizzes(db, [quizId], deletedAt);
  return deletedAt;
}

/** Undoes `removeQuestionFromQuiz`. */
export async function restoreQuizQuestion(
  db: AppDatabase,
  quizId: string,
  questionId: string,
  deletedAt: string,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const timestamp = now();
  await db
    .update(quizQuestions)
    .set({ deletedAt: null, updatedAt: timestamp, dirty: true })
    .where(
      and(
        eq(quizQuestions.quizId, quizId),
        eq(quizQuestions.questionId, questionId),
        eq(quizQuestions.deletedAt, deletedAt),
      ),
    );
  await touchQuizzes(db, [quizId], timestamp);
}

export async function setQuestionPoints(
  db: AppDatabase,
  quizId: string,
  questionId: string,
  points: number,
  { now = isoNow }: NowDep = {},
): Promise<void> {
  if (!Number.isInteger(points) || points < POINTS_LIMITS.min || points > POINTS_LIMITS.max) {
    throw new Error('Points must be a whole number from 1 to 100');
  }
  const timestamp = now();
  await db
    .update(quizQuestions)
    .set({ points, updatedAt: timestamp, dirty: true })
    .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)));
  await touchQuizzes(db, [quizId], timestamp);
}

/**
 * Puts a quiz's questions in this order (question ids, first to last). Positions are rewritten
 * 0, 1, 2…; only rows whose position changes are marked dirty. Ids not in the quiz are ignored,
 * and live questions missing from the list keep their order after the listed ones.
 */
export async function reorderQuizQuestions(
  db: AppDatabase,
  quizId: string,
  orderedIds: readonly string[],
  { now = isoNow }: NowDep = {},
): Promise<void> {
  const current = await listQuizQuestions(db, quizId);
  const currentIds = current.map((row) => row.question.id);
  const listed = orderedIds.filter((id) => currentIds.includes(id));
  const order = [...new Set(listed), ...currentIds.filter((id) => !listed.includes(id))];
  const timestamp = now();
  let changed = false;
  for (const [position, questionId] of order.entries()) {
    const row = current.find((r) => r.question.id === questionId);
    if (row?.position === position) continue;
    changed = true;
    await db
      .update(quizQuestions)
      .set({ position, updatedAt: timestamp, dirty: true })
      .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.questionId, questionId)));
  }
  if (changed) await touchQuizzes(db, [quizId], timestamp);
}

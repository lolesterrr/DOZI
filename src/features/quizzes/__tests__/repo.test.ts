import { createFolder, deleteFolder, restoreFolders } from '@/features/library/repo';
import { createTestDatabase } from '@/test-utils/db';
import { sampleQuestions } from '@/test-utils/sampleQuestions';

import { questionToDraft, tidyQuestionDraft, type QuestionDraft } from '../logic';
import {
  addQuestionsToQuiz,
  createQuestion,
  createQuestionInQuiz,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  getQuestion,
  getQuiz,
  listQuestions,
  listQuizQuestions,
  moveQuiz,
  questionQuizCounts,
  quizIdsUsingQuestion,
  quizListQuery,
  removeQuestionFromQuiz,
  renameQuiz,
  reorderQuizQuestions,
  restoreQuestion,
  restoreQuiz,
  restoreQuizQuestion,
  setQuestionPoints,
  setQuizPinned,
  updateQuestion,
  updateQuizSettings,
} from '../repo';
import { DEFAULT_QUIZ_SETTINGS, parseQuizSettings } from '../types';

// SAMPLE content for tests only — made-up words, no drug facts.
const owner = 'owner-1';
const minutes = (n: number) => new Date(Date.UTC(2026, 9, 9, 10, n)).toISOString();
const at = (n: number) => ({ now: () => minutes(n) });

let ids = 0;
const newId = () => `id-${++ids}`;

async function setup() {
  const db = createTestDatabase();
  const quiz = await createQuiz(
    db,
    { ownerId: owner, title: '  SAMPLE   quiz ' },
    { newId, now: () => minutes(0) },
  );
  return { db, quiz };
}

const typesInOrder = (rows: { question: { type: string } }[]) => rows.map((r) => r.question.type);

describe('quizzes', () => {
  it('creates a quiz with a tidy title and default settings', async () => {
    const { db, quiz } = await setup();
    expect(quiz.title).toBe('SAMPLE quiz');
    expect(parseQuizSettings(quiz.settingsJson)).toEqual(DEFAULT_QUIZ_SETTINGS);
    await expect(createQuiz(db, { ownerId: owner, title: ' ' })).rejects.toThrow();
  });

  it('renames, pins, moves and saves settings, marking the row dirty', async () => {
    const { db, quiz } = await setup();
    await renameQuiz(db, quiz.id, 'SAMPLE renamed', at(1));
    await setQuizPinned(db, quiz.id, true, at(2));
    await moveQuiz(db, quiz.id, 'folder-1', at(3));
    const exam = { ...DEFAULT_QUIZ_SETTINGS, mode: 'exam' as const, timeLimitSec: 1800 };
    await updateQuizSettings(db, quiz.id, exam, at(4));
    const saved = await getQuiz(db, quiz.id);
    expect(saved).toMatchObject({
      title: 'SAMPLE renamed',
      pinned: true,
      folderId: 'folder-1',
      updatedAt: minutes(4),
      dirty: true,
    });
    expect(parseQuizSettings(saved?.settingsJson)).toEqual(exam);
    await expect(updateQuizSettings(db, quiz.id, { ...exam, passMark: 150 })).rejects.toThrow();
  });
});

describe('the question bank', () => {
  it('saves every type and reads it back identically', async () => {
    const { db } = await setup();
    for (const draft of Object.values(sampleQuestions)) {
      const saved = await createQuestion(db, { ownerId: owner, draft }, { newId });
      expect(saved).toMatchObject({ source: 'user', ownerId: owner, dirty: true });
      expect(questionToDraft(saved)).toEqual(tidyQuestionDraft(draft));
    }
    expect(await listQuestions(db, owner)).toHaveLength(6);
  });

  it('refuses a question that is not finished', async () => {
    const { db } = await setup();
    const unfinished = { ...sampleQuestions.sba, stem: { text: '', mediaIds: [] } };
    await expect(createQuestion(db, { ownerId: owner, draft: unfinished })).rejects.toThrow(
      /stemEmpty/,
    );
  });

  it('updates a question and touches every quiz it is in', async () => {
    const { db, quiz } = await setup();
    const question = await createQuestionInQuiz(
      db,
      { ownerId: owner, quizId: quiz.id, draft: sampleQuestions.sba },
      { newId, now: () => minutes(1) },
    );
    const edited: QuestionDraft = {
      ...sampleQuestions.sba,
      stem: { text: 'SAMPLE edited', mediaIds: [] },
    };
    await updateQuestion(db, question.id, edited, at(5));
    expect((await getQuestion(db, question.id))?.stemText).toBe('SAMPLE edited');
    expect((await getQuiz(db, quiz.id))?.updatedAt).toBe(minutes(5));
  });

  it('deletes a question from the bank and its quizzes; undo puts it back in both', async () => {
    const { db, quiz } = await setup();
    const question = await createQuestionInQuiz(
      db,
      { ownerId: owner, quizId: quiz.id, draft: sampleQuestions.mtf },
      { newId },
    );
    const deletedAt = await deleteQuestion(db, question.id, at(2));
    expect(await listQuestions(db, owner)).toEqual([]);
    expect(await listQuizQuestions(db, quiz.id)).toEqual([]);
    await restoreQuestion(db, question.id, deletedAt, at(3));
    expect(await listQuestions(db, owner)).toHaveLength(1);
    expect(await listQuizQuestions(db, quiz.id)).toHaveLength(1);
  });

  it('counts the quizzes each question is in (not deleted ones)', async () => {
    const { db, quiz } = await setup();
    const other = await createQuiz(db, { ownerId: owner, title: 'SAMPLE other' }, { newId });
    const question = await createQuestion(
      db,
      { ownerId: owner, draft: sampleQuestions.saq },
      { newId },
    );
    await addQuestionsToQuiz(db, quiz.id, [question.id]);
    await addQuestionsToQuiz(db, other.id, [question.id]);
    expect((await questionQuizCounts(db, owner)).get(question.id)).toBe(2);
    await deleteQuiz(db, other.id);
    expect((await questionQuizCounts(db, owner)).get(question.id)).toBe(1);
    expect(await quizIdsUsingQuestion(db, question.id)).toEqual([quiz.id]);
  });
});

describe('building a quiz', () => {
  it('builds a quiz with one question of each type (the task 1.10 "done when")', async () => {
    const { db, quiz } = await setup();
    // Half written inline, half picked from the bank.
    const inline = ['sba', 'mtf', 'multiple_response'] as const;
    for (const [i, type] of inline.entries()) {
      await createQuestionInQuiz(
        db,
        { ownerId: owner, quizId: quiz.id, draft: sampleQuestions[type] },
        { newId, now: () => minutes(i + 1) },
      );
    }
    const banked = [];
    for (const type of ['fill_blank', 'matching', 'saq'] as const) {
      banked.push(
        await createQuestion(db, { ownerId: owner, draft: sampleQuestions[type] }, { newId }),
      );
    }
    await addQuestionsToQuiz(
      db,
      quiz.id,
      banked.map((q) => q.id),
      at(10),
    );

    const rows = await listQuizQuestions(db, quiz.id);
    expect(typesInOrder(rows)).toEqual([
      'sba',
      'mtf',
      'multiple_response',
      'fill_blank',
      'matching',
      'saq',
    ]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rows.map((r) => r.points)).toEqual([1, 2, 2, 2, 2, 2]);
    for (const row of rows) expect(questionToDraft(row.question)).not.toBeNull();

    const [listed] = await quizListQuery(db, owner);
    expect(Number(listed.questionCount)).toBe(6);
    expect(listed.updatedAt).toBe(minutes(10));
  });

  it('skips questions already in the quiz and revives removed ones', async () => {
    const { db, quiz } = await setup();
    const a = await createQuestion(db, { ownerId: owner, draft: sampleQuestions.sba }, { newId });
    const b = await createQuestion(db, { ownerId: owner, draft: sampleQuestions.saq }, { newId });
    await addQuestionsToQuiz(db, quiz.id, [a.id, a.id, 'missing']);
    await addQuestionsToQuiz(db, quiz.id, [a.id, b.id]);
    expect((await listQuizQuestions(db, quiz.id)).map((r) => r.question.id)).toEqual([a.id, b.id]);

    await setQuestionPoints(db, quiz.id, a.id, 7);
    await removeQuestionFromQuiz(db, quiz.id, a.id);
    expect((await listQuizQuestions(db, quiz.id)).map((r) => r.question.id)).toEqual([b.id]);
    // Adding it again puts it at the end with fresh points.
    await addQuestionsToQuiz(db, quiz.id, [a.id]);
    const rows = await listQuizQuestions(db, quiz.id);
    expect(rows.map((r) => r.question.id)).toEqual([b.id, a.id]);
    expect(rows[1].points).toBe(1);
  });

  it('undoes removing a question, back in its old place', async () => {
    const { db, quiz } = await setup();
    const made = [];
    for (const type of ['sba', 'mtf', 'saq'] as const) {
      made.push(
        await createQuestionInQuiz(
          db,
          { ownerId: owner, quizId: quiz.id, draft: sampleQuestions[type] },
          { newId },
        ),
      );
    }
    const deletedAt = await removeQuestionFromQuiz(db, quiz.id, made[1].id, at(4));
    expect(typesInOrder(await listQuizQuestions(db, quiz.id))).toEqual(['sba', 'saq']);
    await restoreQuizQuestion(db, quiz.id, made[1].id, deletedAt);
    expect(typesInOrder(await listQuizQuestions(db, quiz.id))).toEqual(['sba', 'mtf', 'saq']);
  });

  it('reorders questions and checks points', async () => {
    const { db, quiz } = await setup();
    const made = [];
    for (const type of ['sba', 'mtf', 'saq'] as const) {
      made.push(
        await createQuestionInQuiz(
          db,
          { ownerId: owner, quizId: quiz.id, draft: sampleQuestions[type] },
          { newId },
        ),
      );
    }
    await reorderQuizQuestions(db, quiz.id, [made[2].id, made[0].id], at(20));
    const rows = await listQuizQuestions(db, quiz.id);
    // Unlisted questions keep their order after the listed ones.
    expect(typesInOrder(rows)).toEqual(['saq', 'sba', 'mtf']);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect((await getQuiz(db, quiz.id))?.updatedAt).toBe(minutes(20));

    await setQuestionPoints(db, quiz.id, made[0].id, 5);
    expect((await listQuizQuestions(db, quiz.id))[1].points).toBe(5);
    await expect(setQuestionPoints(db, quiz.id, made[0].id, 0)).rejects.toThrow();
    await expect(setQuestionPoints(db, quiz.id, made[0].id, 1.5)).rejects.toThrow();
  });

  it('will not add to a deleted quiz', async () => {
    const { db, quiz } = await setup();
    await deleteQuiz(db, quiz.id);
    await expect(
      createQuestionInQuiz(db, { ownerId: owner, quizId: quiz.id, draft: sampleQuestions.sba }),
    ).rejects.toThrow();
    // Nothing was written to the bank either.
    expect(await listQuestions(db, owner)).toEqual([]);
  });
});

describe('deleting quizzes', () => {
  it('deletes a quiz but keeps its questions in the bank; undo restores its questions', async () => {
    const { db, quiz } = await setup();
    await createQuestionInQuiz(
      db,
      { ownerId: owner, quizId: quiz.id, draft: sampleQuestions.sba },
      { newId },
    );
    const deletedAt = await deleteQuiz(db, quiz.id, at(5));
    expect(await quizListQuery(db, owner)).toEqual([]);
    expect(await listQuestions(db, owner)).toHaveLength(1);
    await restoreQuiz(db, quiz.id, deletedAt, at(6));
    expect(await listQuizQuestions(db, quiz.id)).toHaveLength(1);
  });

  it('deletes quizzes inside a deleted folder, and undo brings them back', async () => {
    const db = createTestDatabase();
    const folder = await createFolder(db, { ownerId: owner, kind: 'quiz', name: 'SAMPLE folder' });
    const inside = await createQuiz(db, {
      ownerId: owner,
      folderId: folder.id,
      title: 'SAMPLE inside',
    });
    const outside = await createQuiz(db, { ownerId: owner, title: 'SAMPLE outside' });
    // Deleted before the folder: stays deleted after undo.
    const earlier = await createQuiz(db, {
      ownerId: owner,
      folderId: folder.id,
      title: 'SAMPLE earlier',
    });
    await deleteQuiz(db, earlier.id, at(1));

    const deleted = await deleteFolder(db, folder.id, at(2));
    const titles = async () => (await quizListQuery(db, owner)).map((q) => q.title).sort();
    expect(await titles()).toEqual([outside.title]);
    await restoreFolders(db, deleted, at(3));
    expect(await titles()).toEqual([inside.title, outside.title].sort());
  });
});

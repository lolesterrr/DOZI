import { and, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { questions, quizzes, type Question, type Quiz } from '@/db/schema';
import { useProfile } from '@/features/profile/hooks';
import { createLogger } from '@/lib/logger';

import type { QuestionDraft } from './logic';
import * as repo from './repo';
import type { QuizSettings } from './types';

const log = createLogger('quizzes');

function useOwnerId(): string {
  return useProfile().profile?.id ?? '';
}

/** One quiz (including a deleted one, so the screen can say it's gone). */
export function useQuiz(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1),
    [id],
  );
  return { quiz: data[0] as Quiz | undefined, loading: updatedAt === undefined };
}

/**
 * A quiz's questions in order. Live queries only watch their first table, so this re-reads when
 * `refreshKey` changes (pass the quiz's `updatedAt`: every change to its questions touches it) and
 * when the screen comes back into view (after editing a question).
 */
export function useQuizQuestions(quizId: string, refreshKey?: unknown) {
  const db = useDatabase();
  const [rows, setRows] = useState<repo.QuizQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      repo
        .listQuizQuestions(db, quizId)
        .then((next) => {
          if (!active) return;
          setRows(next);
          setLoading(false);
        })
        .catch((error: unknown) =>
          log.warn('Loading quiz questions failed', { error: String(error) }),
        );
      return () => {
        active = false;
      };
      // refreshKey isn't read: changing it is what asks for a reload.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, quizId, refreshKey]),
  );
  return { rows, loading };
}

/** Every question in the bank, most recently changed first, kept up to date. */
export function useQuestionBank(): Question[] {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const { data } = useLiveQuery(
    db
      .select()
      .from(questions)
      .where(and(eq(questions.ownerId, ownerId), isNull(questions.deletedAt)))
      .orderBy(desc(questions.updatedAt)),
    [ownerId],
  );
  return data;
}

/** question id → how many quizzes it is in. Re-counted on focus and when `refreshKey` changes. */
export function useQuestionQuizCounts(refreshKey?: unknown): Map<string, number> {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return undefined;
      let active = true;
      repo
        .questionQuizCounts(db, ownerId)
        .then((next) => {
          if (active) setCounts(next);
        })
        .catch((error: unknown) =>
          log.warn('Counting question use failed', { error: String(error) }),
        );
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, ownerId, refreshKey]),
  );
  return counts;
}

/** One question (including a deleted one). */
export function useQuestion(id: string) {
  const db = useDatabase();
  const { data, updatedAt } = useLiveQuery(
    db.select().from(questions).where(eq(questions.id, id)).limit(1),
    [id],
  );
  return { question: data[0] as Question | undefined, loading: updatedAt === undefined };
}

/** Quiz and question changes, bound to the database and the profile. */
export function useQuizActions() {
  const db = useDatabase();
  const ownerId = useOwnerId();
  return useMemo(
    () => ({
      createQuiz: (title: string, folderId: string | null = null) =>
        repo.createQuiz(db, { ownerId, folderId, title }),
      renameQuiz: (id: string, title: string) => repo.renameQuiz(db, id, title),
      updateSettings: (id: string, settings: QuizSettings) =>
        repo.updateQuizSettings(db, id, settings),
      setPinned: (id: string, pinned: boolean) => repo.setQuizPinned(db, id, pinned),
      moveQuiz: (id: string, folderId: string | null) => repo.moveQuiz(db, id, folderId),
      deleteQuiz: (id: string) => repo.deleteQuiz(db, id),
      restoreQuiz: (id: string, deletedAt: string) => repo.restoreQuiz(db, id, deletedAt),
      createQuestion: (draft: QuestionDraft) => repo.createQuestion(db, { ownerId, draft }),
      createQuestionInQuiz: (quizId: string, draft: QuestionDraft) =>
        repo.createQuestionInQuiz(db, { ownerId, quizId, draft }),
      updateQuestion: (id: string, draft: QuestionDraft) => repo.updateQuestion(db, id, draft),
      deleteQuestion: (id: string) => repo.deleteQuestion(db, id),
      restoreQuestion: (id: string, deletedAt: string) => repo.restoreQuestion(db, id, deletedAt),
      quizIdsUsingQuestion: (id: string) => repo.quizIdsUsingQuestion(db, id),
      addQuestionsToQuiz: (quizId: string, questionIds: readonly string[]) =>
        repo.addQuestionsToQuiz(db, quizId, questionIds),
      removeFromQuiz: (quizId: string, questionId: string) =>
        repo.removeQuestionFromQuiz(db, quizId, questionId),
      restoreToQuiz: (quizId: string, questionId: string, deletedAt: string) =>
        repo.restoreQuizQuestion(db, quizId, questionId, deletedAt),
      setPoints: (quizId: string, questionId: string, points: number) =>
        repo.setQuestionPoints(db, quizId, questionId, points),
      reorder: (quizId: string, orderedIds: readonly string[]) =>
        repo.reorderQuizQuestions(db, quizId, orderedIds),
    }),
    [db, ownerId],
  );
}

export type QuizActions = ReturnType<typeof useQuizActions>;

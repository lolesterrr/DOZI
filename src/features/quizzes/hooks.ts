import { and, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { questions, quizzes, type Question, type Quiz, type QuizAttempt } from '@/db/schema';
import type { CardDraft } from '@/features/decks/logic';
import { createDeck } from '@/features/decks/repo';
import { useXpActions } from '@/features/gamification/hooks';
import { useProfile } from '@/features/profile/hooks';
import { createLogger } from '@/lib/logger';
import { nowIso } from '@/lib/time';

import {
  buildAttemptResult,
  buildPlayItems,
  distinctRights,
  questionToDraft,
  unmarkedSaqs,
  type PlayItem,
  type QuestionDraft,
} from './logic';
import { openAttempt } from './navigation';
import * as repo from './repo';
import {
  parseQuizSettings,
  parseResponse,
  type QuestionResponseValue,
  type QuizSettings,
  type SaqResponse,
} from './types';

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

// ---------------------------------------------------------------------------------------------
// Taking a quiz (task 1.11)

export type PlayerPhase =
  | 'loading'
  /** The quiz was deleted. */
  | 'missing'
  /** No question that can be shown. */
  | 'empty'
  /** A retry of an attempt that got everything right. */
  | 'noneWrong'
  | 'intro'
  | 'playing'
  /** Exam mode, after submitting: the student self-marks their short answers. */
  | 'marking'
  | 'saving'
  | 'failed';

type Responses = Record<string, QuestionResponseValue | null>;

/**
 * Everything the quiz player needs: the questions in the order shown, the answers so far, flags,
 * which questions were checked (practice), the time spent on each, and saving the attempt. The
 * attempt is written only when the student finishes, then the results screen replaces this one.
 */
export function useQuizPlayer(quizId: string, retryOf: string | null) {
  const db = useDatabase();
  const ownerId = useOwnerId();
  const xp = useXpActions();
  const [phase, setPhase] = useState<PlayerPhase>('loading');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [settings, setSettings] = useState<QuizSettings>(() => parseQuizSettings(null));
  const [items, setItems] = useState<PlayItem[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Responses>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [markQueue, setMarkQueue] = useState<string[]>([]);
  const [markIndex, setMarkIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<{ iso: string; ms: number } | null>(null);
  // Mirrors of state that saving reads after other updates in the same tap.
  const responsesRef = useRef<Responses>({});
  const flaggedRef = useRef<Record<string, boolean>>({});
  const timeMs = useRef<Record<string, number>>({});
  /** When the question on screen started being answered (ms), or null while it isn't. */
  const enteredAt = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await repo.getQuiz(db, quizId);
      if (!active) return;
      if (!found || found.deletedAt) return setPhase('missing');
      const quizSettings = parseQuizSettings(found.settingsJson);
      let rows = await repo.listQuizQuestions(db, quizId);
      if (retryOf) {
        const wrong = new Set(await repo.wrongQuestionIds(db, retryOf));
        rows = rows.filter((row) => wrong.has(row.question.id));
        if (rows.length === 0) {
          if (active) setPhase('noneWrong');
          return;
        }
      }
      const readable: { questionId: string; points: number; question: QuestionDraft }[] = [];
      for (const row of rows) {
        const draft = questionToDraft(row.question);
        if (draft)
          readable.push({ questionId: row.question.id, points: row.points, question: draft });
      }
      if (!active) return;
      setQuiz(found);
      setSettings(quizSettings);
      setSkipped(rows.length - readable.length);
      setItems(buildPlayItems(readable, quizSettings));
      setPhase(readable.length === 0 ? 'empty' : 'intro');
    })().catch((error: unknown) => {
      log.warn('Loading the quiz failed', { error: String(error) });
      if (active) setPhase('missing');
    });
    return () => {
      active = false;
    };
  }, [db, quizId, retryOf]);

  const current = items[index];

  /** Adds the time since the question was shown to its total, and stops the clock. */
  const stopClock = useCallback(() => {
    const id = items[index]?.questionId;
    if (id && enteredAt.current !== null) {
      timeMs.current[id] = (timeMs.current[id] ?? 0) + (Date.now() - enteredAt.current);
    }
    enteredAt.current = null;
  }, [items, index]);

  const begin = useCallback(() => {
    setStartedAt({ iso: nowIso(), ms: Date.now() });
    setIndex(0);
    enteredAt.current = Date.now();
    setPhase('playing');
  }, []);

  const setResponse = useCallback((questionId: string, response: QuestionResponseValue) => {
    responsesRef.current = { ...responsesRef.current, [questionId]: response };
    setResponses(responsesRef.current);
  }, []);

  const save = useCallback(async () => {
    if (!startedAt || !ownerId) return;
    setPhase('saving');
    try {
      const result = buildAttemptResult(items, responsesRef.current, settings, {
        timeMs: timeMs.current,
        flagged: flaggedRef.current,
      });
      const attempt = await repo.saveAttempt(db, {
        ownerId,
        quizId,
        mode: settings.mode,
        settings,
        retryOf,
        startedAt: startedAt.iso,
        result,
      });
      // XP for the correct answers (PRODUCT_SPEC §8.1). A failure here never loses the attempt.
      await xp.award({
        source: 'quiz_correct_own',
        sourceId: attempt.id,
        count: result.responses.filter((r) => r.isCorrect).length,
      });
      openAttempt(attempt.id, { replace: true });
    } catch (error) {
      log.warn('Saving the attempt failed', { error: String(error) });
      setPhase('failed');
    }
  }, [db, ownerId, items, settings, quizId, retryOf, startedAt, xp]);

  /** Practice: check the answer on screen. A short answer is marked by ticking points next. */
  const check = useCallback(() => {
    if (!current) return;
    stopClock();
    if (current.question.type === 'saq') {
      const response = (responsesRef.current[current.questionId] as SaqResponse | null) ?? {
        text: '',
        ticked: [],
        marked: false,
      };
      setResponse(current.questionId, { ...response, marked: true });
    }
    setChecked((was) => ({ ...was, [current.questionId]: true }));
  }, [current, stopClock, setResponse]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length) return;
      stopClock();
      setIndex(next);
      enteredAt.current = Date.now();
    },
    [items.length, stopClock],
  );

  const toggleFlag = useCallback(() => {
    if (!current) return;
    flaggedRef.current = {
      ...flaggedRef.current,
      [current.questionId]: !flaggedRef.current[current.questionId],
    };
    setFlagged(flaggedRef.current);
  }, [current]);

  /** Exam: hand in. Written short answers are self-marked first. */
  const submit = useCallback(() => {
    stopClock();
    const toMark = unmarkedSaqs(items, responsesRef.current)
      .filter((item) => {
        const response = responsesRef.current[item.questionId] as SaqResponse | null | undefined;
        return (response?.text.trim() ?? '') !== '';
      })
      .map((item) => item.questionId);
    if (toMark.length > 0) {
      setMarkQueue(toMark);
      setMarkIndex(0);
      setPhase('marking');
    } else void save();
  }, [items, stopClock, save]);

  /** Marking: this short answer is done; on to the next, or save after the last. */
  const markNext = useCallback(() => {
    const id = markQueue[markIndex];
    if (id) {
      const response = responsesRef.current[id] as SaqResponse | null;
      if (response) setResponse(id, { ...response, marked: true });
    }
    if (markIndex + 1 < markQueue.length) setMarkIndex(markIndex + 1);
    else void save();
  }, [markQueue, markIndex, setResponse, save]);

  /** Practice: the next question, or save after the last. */
  const next = useCallback(() => {
    if (index + 1 < items.length) goTo(index + 1);
    else void save();
  }, [index, items.length, goTo, save]);

  /** "Finish and see results" from the leave sheet. */
  const finishNow = useCallback(() => {
    if (settings.mode === 'exam') submit();
    else {
      stopClock();
      void save();
    }
  }, [settings.mode, submit, stopClock, save]);

  const markItem =
    phase === 'marking' ? items.find((i) => i.questionId === markQueue[markIndex]) : undefined;

  return {
    phase,
    quiz,
    settings,
    items,
    skipped,
    index,
    current,
    responses,
    checked,
    flagged,
    startedAtMs: startedAt?.ms ?? null,
    markItem,
    markIndex,
    markCount: markQueue.length,
    begin,
    setResponse,
    check,
    next,
    goTo,
    toggleFlag,
    submit,
    markNext,
    finishNow,
    retrySave: save,
  };
}

export type QuizPlayer = ReturnType<typeof useQuizPlayer>;

// ---------------------------------------------------------------------------------------------
// Results and history

export type AttemptReview = {
  item: PlayItem;
  response: QuestionResponseValue | null;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  flagged: boolean;
  questionDeleted: boolean;
};

/** An attempt with its quiz and each response, ready for the results screen. */
export function useAttemptResults(attemptId: string) {
  const db = useDatabase();
  const [state, setState] = useState<{
    loading: boolean;
    attempt: QuizAttempt | null;
    quiz: Quiz | null;
    reviews: AttemptReview[];
  }>({ loading: true, attempt: null, quiz: null, reviews: [] });

  useEffect(() => {
    let active = true;
    (async () => {
      const attempt = await repo.getAttempt(db, attemptId);
      if (!attempt || attempt.deletedAt) {
        if (active) setState({ loading: false, attempt: null, quiz: null, reviews: [] });
        return;
      }
      const quiz = attempt.quizId ? ((await repo.getQuiz(db, attempt.quizId)) ?? null) : null;
      const rows = await repo.listAttemptResponses(db, attemptId);
      const reviews: AttemptReview[] = [];
      for (const { response, question } of rows) {
        const draft = questionToDraft(question);
        if (!draft) continue;
        reviews.push({
          item: {
            questionId: question.id,
            points: response.maxScore,
            question: draft,
            optionOrder: [],
            matchChoices: draft.type === 'matching' ? distinctRights(draft.payload.pairs) : [],
          },
          response: parseResponse(draft.type, response.responseJson),
          score: response.score,
          maxScore: response.maxScore,
          isCorrect: response.isCorrect,
          flagged: response.flagged,
          questionDeleted: question.deletedAt !== null,
        });
      }
      if (active) setState({ loading: false, attempt, quiz, reviews });
    })().catch((error: unknown) => {
      log.warn('Loading results failed', { error: String(error) });
      if (active) setState({ loading: false, attempt: null, quiz: null, reviews: [] });
    });
    return () => {
      active = false;
    };
  }, [db, attemptId]);

  return state;
}

/** A quiz's finished attempts, newest first. Re-read on focus and when `refreshKey` changes. */
export function useQuizAttempts(quizId: string, refreshKey?: unknown): QuizAttempt[] {
  const db = useDatabase();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      repo
        .listQuizAttempts(db, quizId)
        .then((next) => {
          if (active) setAttempts(next);
        })
        .catch((error: unknown) => log.warn('Loading attempts failed', { error: String(error) }));
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, quizId, refreshKey]),
  );
  return attempts;
}

/** "Add wrong ones to flashcards": into an existing deck, or a new one with this title. */
export function useAddToFlashcards() {
  const db = useDatabase();
  const ownerId = useOwnerId();
  return useCallback(
    async (target: { deckId: string } | { newDeckTitle: string }, cards: readonly CardDraft[]) => {
      const deckId =
        'deckId' in target
          ? target.deckId
          : (await createDeck(db, { ownerId, title: target.newDeckTitle })).id;
      const added = await repo.addCardsToDeck(db, { ownerId, deckId, cards });
      return { deckId, added };
    },
    [db, ownerId],
  );
}

import { router } from 'expo-router';

import type { QuestionType } from '@/db/schema';

/** Opens a quiz in the quiz builder. */
export function openQuiz(quizId: string) {
  router.push({ pathname: '/quiz/[id]/edit', params: { id: quizId } });
}

/**
 * Opens the question editor. `questionId` "new" writes a new question: with `quizId` it is added
 * to that quiz when saved, otherwise it only goes in the bank.
 */
export function openQuestionEditor(
  questionId: string,
  options: { quizId?: string; type?: QuestionType } = {},
) {
  const params: { id: string; quizId?: string; type?: QuestionType } = { id: questionId };
  if (options.quizId) params.quizId = options.quizId;
  if (options.type) params.type = options.type;
  router.push({ pathname: '/question/[id]', params });
}

/** Opens the question bank. */
export function openQuestionBank() {
  router.push('/questions');
}

/** Takes a quiz. With `retryOf`, only the questions that attempt didn't get fully right. */
export function playQuiz(quizId: string, options: { retryOf?: string; replace?: boolean } = {}) {
  const params: { id: string; retry?: string } = { id: quizId };
  if (options.retryOf) params.retry = options.retryOf;
  const href = { pathname: '/quiz/[id]/play' as const, params };
  if (options.replace) router.replace(href);
  else router.push(href);
}

/** Opens an attempt's results. */
export function openAttempt(attemptId: string, options: { replace?: boolean } = {}) {
  const href = { pathname: '/quiz/attempt/[attemptId]' as const, params: { attemptId } };
  if (options.replace) router.replace(href);
  else router.push(href);
}

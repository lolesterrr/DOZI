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
  const params: Record<string, string> = { id: questionId };
  if (options.quizId) params.quizId = options.quizId;
  if (options.type) params.type = options.type;
  router.push({ pathname: '/question/[id]', params });
}

/** Opens the question bank. */
export function openQuestionBank() {
  router.push('/questions');
}

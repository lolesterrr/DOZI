import { useLocalSearchParams } from 'expo-router';

import { QuestionEditorScreen } from '@/features/quizzes';

// The question editor. `id` "new" writes a question (added to `quizId` when given, otherwise
// only to the bank, starting as `type`); any other id edits that question.
export default function QuestionEditorRoute() {
  const { id, quizId, type } = useLocalSearchParams<{
    id: string;
    quizId?: string;
    type?: string;
  }>();
  return <QuestionEditorScreen questionId={id} quizId={quizId} type={type} />;
}

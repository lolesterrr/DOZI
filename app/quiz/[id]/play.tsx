import { useLocalSearchParams } from 'expo-router';

import { QuizPlayerScreen } from '@/features/quizzes';

// Taking a quiz: `/quiz/<id>/play`, or `/quiz/<id>/play?retry=<attempt id>` for "Retry wrong
// only". Saving the attempt replaces this screen with its results.
export default function QuizPlayRoute() {
  const { id, retry } = useLocalSearchParams<{ id: string; retry?: string }>();
  const retryOf = typeof retry === 'string' && retry ? retry : null;
  // key: a fresh player if the same screen is reused for another quiz or retry.
  return <QuizPlayerScreen key={`${id}:${retryOf ?? ''}`} quizId={id} retryOf={retryOf} />;
}

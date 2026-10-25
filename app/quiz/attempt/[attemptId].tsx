import { useLocalSearchParams } from 'expo-router';

import { AttemptResultsScreen } from '@/features/quizzes';

// One attempt's results: score, pass mark, time, review of every answer, "Retry wrong only" and
// "Add wrong ones to flashcards". Opened after finishing a quiz and from "Past attempts".
export default function AttemptRoute() {
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  return <AttemptResultsScreen key={attemptId} attemptId={attemptId} />;
}

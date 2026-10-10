import { useLocalSearchParams } from 'expo-router';

import { QuizBuilderScreen } from '@/features/quizzes';

// The quiz builder: a quiz's questions, their order and points, and its settings. Opened from
// the Library or "+ Create → New quiz". Taking the quiz (`play`) arrives with task 1.11.
export default function QuizEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <QuizBuilderScreen id={id} />;
}

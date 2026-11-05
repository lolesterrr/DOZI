import { useLocalSearchParams } from 'expo-router';

import { parseDrillRoute } from '@/features/practice/logic';
import { QuizPlayerScreen } from '@/features/quizzes';

// A drill from the Practice tab, played like a quiz: `/drill/quick` (10 random questions from
// the bank, or `?from=<quiz id>,<quiz id>` to pick only from those quizzes) or `/drill/mistakes`.
// `?retry=<attempt id>` asks only what that attempt got wrong.
export default function DrillRoute() {
  const params = useLocalSearchParams<{ kind: string; from?: string; retry?: string }>();
  const retryOf = typeof params.retry === 'string' && params.retry ? params.retry : null;
  // An unknown kind falls back to a quick quiz from the whole bank.
  const drill = parseDrillRoute(params.kind, params.from) ?? { kind: 'quick', quizIds: [] };
  // key: a fresh player each time, so a new quick quiz picks new questions.
  return (
    <QuizPlayerScreen
      key={`${params.kind}:${params.from ?? ''}:${retryOf ?? ''}`}
      drill={drill}
      retryOf={retryOf}
    />
  );
}

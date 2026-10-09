import { useLocalSearchParams } from 'expo-router';

import { parseReviewRoute, ReviewScreen } from '@/features/review';

// A review session: `/review/all` (every deck) or `/review/<deck id>`; `?mode=cram` to cram.
export default function ReviewRoute() {
  const params = useLocalSearchParams<{ scope: string; mode?: string }>();
  const { scope, mode } = parseReviewRoute(params.scope, params.mode);
  // key: a fresh session if the same screen is reused for another deck or mode.
  return <ReviewScreen key={`${params.scope}:${mode}`} scope={scope} mode={mode} />;
}

import { useLocalSearchParams } from 'expo-router';

import { parseReviewRoute, ReviewScreen } from '@/features/review';

// A review session: `/review/all` (every deck) or `/review/<deck id>`; `?mode=cram` to cram;
// `&tag=<name>` to cram one card tag.
export default function ReviewRoute() {
  const params = useLocalSearchParams<{ scope: string; mode?: string; tag?: string }>();
  const { scope, mode, tag } = parseReviewRoute(params.scope, params.mode, params.tag);
  // key: a fresh session if the same screen is reused for another deck, mode or tag.
  return (
    <ReviewScreen
      key={`${params.scope}:${mode}:${tag ?? ''}`}
      scope={scope}
      mode={mode}
      tag={tag ?? null}
    />
  );
}

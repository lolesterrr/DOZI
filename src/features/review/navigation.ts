import { router } from 'expo-router';

import type { ReviewMode } from './logic';

/** Opens a review session for one deck (by id) or for every deck ("all"). */
export function openReview(scope: string, mode: ReviewMode = 'review', tag?: string) {
  router.push({
    pathname: '/review/[scope]',
    params: mode === 'cram' ? (tag ? { scope, mode, tag } : { scope, mode }) : { scope },
  });
}

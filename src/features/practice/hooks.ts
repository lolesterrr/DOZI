import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useProfile } from '@/features/profile/hooks';
import { createLogger } from '@/lib/logger';

import { loadPracticeSummary, type PracticeSummary } from './repo';

const log = createLogger('practice');

/**
 * The Practice tab's quiz cards: the question bank's size, the mistakes waiting and the recent
 * quizzes. Re-read each time the tab comes into view (after a quiz, say). null while loading.
 */
export function usePracticeSummary(): PracticeSummary | null {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id;
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return undefined;
      let active = true;
      loadPracticeSummary(db, ownerId)
        .then((next) => {
          if (active) setSummary(next);
        })
        .catch((error: unknown) =>
          log.warn('Loading the Practice tab failed', { error: String(error) }),
        );
      return () => {
        active = false;
      };
    }, [db, ownerId]),
  );
  return summary;
}

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useProfile } from '@/features/profile/hooks';
import { createLogger } from '@/lib/logger';

import { buildStats, type StatsData, type StatsView } from './logic';
import { loadStatsData } from './repo';

const log = createLogger('stats');

/** The Stats screen's numbers, worked out again each time the screen comes into view. */
export function useStats(): { loading: boolean; stats: StatsView | null } {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id;
  const [data, setData] = useState<StatsData | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return undefined;
      let active = true;
      loadStatsData(db, ownerId)
        .then((next) => active && setData(next))
        .catch((error: unknown) => log.warn('Could not load stats', { error: String(error) }));
      return () => {
        active = false;
      };
    }, [db, ownerId]),
  );

  const stats = useMemo(() => (data ? buildStats(data) : null), [data]);
  return { loading: data === null, stats };
}

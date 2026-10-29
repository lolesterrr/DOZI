import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useProfile } from '@/features/profile/hooks';
import { createLogger } from '@/lib/logger';

import type { OnboardingDraft } from './logic';
import { completeOnboarding, getOnboardingRecord, skipOnboarding } from './repo';

const log = createLogger('onboarding');

export type OnboardingGate = 'loading' | 'needed' | 'done';

/**
 * Whether this device still has to go through onboarding. Read once when the tabs mount; the
 * flow itself sends the student on to Today, which mounts the tabs again.
 */
export function useOnboardingGate(): OnboardingGate {
  const db = useDatabase();
  const [gate, setGate] = useState<OnboardingGate>('loading');
  useEffect(() => {
    let active = true;
    getOnboardingRecord(db)
      .then((record) => active && setGate(record ? 'done' : 'needed'))
      .catch((error: unknown) => {
        // If we can't tell, don't trap the student in onboarding.
        log.warn('Could not read the onboarding setting', { error: String(error) });
        if (active) setGate('done');
      });
    return () => {
      active = false;
    };
  }, [db]);
  return gate;
}

export function useOnboardingActions() {
  const db = useDatabase();
  const profileId = useProfile().profile?.id;
  const finish = useCallback(
    async (draft: OnboardingDraft) => {
      if (!profileId) throw new Error('The profile isn’t ready yet');
      await completeOnboarding(db, profileId, draft);
    },
    [db, profileId],
  );
  const skip = useCallback(() => skipOnboarding(db), [db]);
  return { ready: !!profileId, finish, skip };
}

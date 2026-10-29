import type { AppDatabase } from '@/db/types';
import { updateProfile } from '@/features/profile/repo';
import { getSetting, setSetting } from '@/features/settings/repo';
import { nowIso } from '@/lib/time';

import {
  ONBOARDING_SETTING,
  parseOnboardingRecord,
  profileChangesFromDraft,
  type OnboardingDraft,
  type OnboardingRecord,
} from './logic';

/** Has this device finished or skipped onboarding? */
export async function getOnboardingRecord(db: AppDatabase): Promise<OnboardingRecord | null> {
  return parseOnboardingRecord(await getSetting(db, ONBOARDING_SETTING));
}

/** Saves the answers on the profile and remembers that onboarding is done. */
export async function completeOnboarding(
  db: AppDatabase,
  profileId: string,
  draft: OnboardingDraft,
  now: string = nowIso(),
): Promise<void> {
  await updateProfile(db, profileId, profileChangesFromDraft(draft), { now: () => now });
  await setSetting(db, ONBOARDING_SETTING, { at: now, skipped: false });
}

/** "Skip for now": nothing is changed on the profile (the defaults stay). */
export async function skipOnboarding(db: AppDatabase, now: string = nowIso()): Promise<void> {
  await setSetting(db, ONBOARDING_SETTING, { at: now, skipped: true });
}

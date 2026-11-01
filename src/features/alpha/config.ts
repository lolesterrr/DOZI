import Constants from 'expo-constants';

import type { DayString } from '@/lib/time';

import { parseAlphaExpiry } from './logic';

/** This build's expiry date (set in app.config.js when it was built), or null. */
export function alphaExpiresOn(): DayString | null {
  return parseAlphaExpiry(Constants.expoConfig?.extra?.alphaExpiresOn);
}

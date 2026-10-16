import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { appFonts } from '@/theme/fonts';

const log = createLogger('fonts');

/** How long to wait for the fonts before showing the app in the system font. */
export const FONT_TIMEOUT_MS = 5000;

/**
 * Loads the app fonts. Returns true once the app can be shown: the fonts loaded, failed, or took
 * longer than FONT_TIMEOUT_MS (then the app shows in the system font rather than hang).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(appFonts);
  const [timedOut, setTimedOut] = useState(false);
  const settled = loaded || error != null;

  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => {
      log.warn('Fonts are still loading; showing the app in the system font', {
        timeoutMs: FONT_TIMEOUT_MS,
      });
      setTimedOut(true);
    }, FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [settled]);

  useEffect(() => {
    if (error) log.warn('A font failed to load; using the system font', { error: error.message });
  }, [error]);

  return settled || timedOut;
}

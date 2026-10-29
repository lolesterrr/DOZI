import { useEffect } from 'react';

import { useTheme } from '@/theme';

import { useAppSettings } from './hooks';
import { textScaleFor } from './logic';

/**
 * Puts the saved theme and text size to work. It runs high up in the app, so the choice made in
 * Settings applies everywhere and is back on the next launch.
 */
export function useApplyAppearance() {
  const { setPreference, setTextScale } = useTheme();
  const { loading, settings } = useAppSettings();
  const { theme, textSize } = settings;
  useEffect(() => {
    if (loading) return;
    setPreference(theme);
    setTextScale(textScaleFor[textSize]);
  }, [loading, theme, textSize, setPreference, setTextScale]);
}

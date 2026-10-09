import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScrollView } from 'react-native';

import { Button, Text } from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { ThemeProvider } from '@/theme';

const log = createLogger('error-boundary');
const s = strings.errorBoundary;

/**
 * The app-wide error screen. Expo Router shows it when a screen throws while rendering
 * (exported as `ErrorBoundary` from `app/_layout.tsx`). It brings its own ThemeProvider because
 * the root layout's providers may be the thing that failed.
 */
export function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    log.error('A screen crashed', error);
    // If the crash happened before the first screen, the splash screen would otherwise stay up.
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  return (
    <ThemeProvider>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="flex-grow items-center justify-center gap-4 px-6 py-16"
      >
        <Dozi mood="concerned" />
        <Text variant="title" className="text-center">
          {s.title}
        </Text>
        <Text tone="muted" className="max-w-[320px] text-center">
          {s.message}
        </Text>
        {__DEV__ ? (
          <Text variant="caption" tone="danger" selectable className="max-w-[320px] text-center">
            {error.message}
          </Text>
        ) : null}
        <Button label={s.retry} onPress={() => void retry()} className="mt-2" />
      </ScrollView>
    </ThemeProvider>
  );
}

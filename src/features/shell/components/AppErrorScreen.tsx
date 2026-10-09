import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Text } from '@/components/ui';
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
        {/* Placeholder until Dozi's artwork arrives (task 2.x). */}
        <View
          className="h-24 w-24 items-center justify-center rounded-full bg-primary-soft"
          accessible
          accessibilityLabel={s.mascotLabel}
        >
          <Text variant="heading" tone="inherit" className="text-on-primary-soft">
            {s.mascotPlaceholder}
          </Text>
        </View>
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

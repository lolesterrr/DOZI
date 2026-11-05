import '../global.css';

import {
  type ErrorBoundaryProps,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/ui';
import { useAuthLifecycle } from '@/features/account';
import { useSyncLifecycle } from '@/features/sync';
import { AlphaExpiredScreen, AlphaExpiryNotice, useAlphaExpired } from '@/features/alpha';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { useWeeklyMediaCleanup } from '@/features/media';
import { useNotificationSync } from '@/features/notifications';
import { useApplyAppearance } from '@/features/settings';
import {
  AppErrorScreen,
  StackHeader,
  StartupScreen,
  useAppFonts,
  type StackHeaderProps,
} from '@/features/shell';
import { strings } from '@/i18n/strings';
import { ThemeProvider, useTheme } from '@/theme';

// Keep the splash screen up until the fonts are ready, so text never flashes in the wrong font.
SplashScreen.preventAutoHideAsync();

// Expo Router shows this instead of the app when a screen throws while rendering.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorScreen {...props} />;
}

function ThemedStack() {
  const { navigationTheme, scheme } = useTheme();
  useWeeklyMediaCleanup();
  useApplyAppearance();
  useNotificationSync();
  useAuthLifecycle();
  useSyncLifecycle();
  // Pushed screens (search, folders, stats…) show the doodle top bar with a back button.
  const headerOptions = {
    headerShown: true,
    header: (props: StackHeaderProps) => <StackHeader {...props} />,
  };
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <ToastProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: navigationTheme.colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ ...headerOptions, title: strings.search.title }} />
          <Stack.Screen name="folder/[id]" options={{ ...headerOptions, title: '' }} />
          {/* The note screen draws its own top bar (it sits in a keyboard-avoiding view). */}
          <Stack.Screen name="note/[id]" />
          {/* Deck and card editor screens draw their own top bars too. */}
          <Stack.Screen name="deck/[id]/index" />
          <Stack.Screen name="deck/[id]/card/[cardId]" />
          {/* The review session draws its own top bar (close, progress, undo). */}
          <Stack.Screen name="review/[scope]" />
          {/* Quiz builder, question editor and question bank draw their own top bars too. */}
          <Stack.Screen name="quiz/[id]/edit" />
          {/* The quiz player and results draw their own top bars; no swipe-back mid-quiz. */}
          <Stack.Screen name="quiz/[id]/play" options={{ gestureEnabled: false }} />
          <Stack.Screen name="quiz/attempt/[attemptId]" />
          <Stack.Screen name="question/[id]" />
          <Stack.Screen name="questions" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="settings"
            options={{ ...headerOptions, title: strings.settings.title }}
          />
          <Stack.Screen
            name="privacy"
            options={{ ...headerOptions, title: strings.privacy.title }}
          />
          <Stack.Screen
            name="alpha-notes"
            options={{ ...headerOptions, title: strings.alpha.title }}
          />
          <Stack.Screen name="stats" options={{ ...headerOptions, title: strings.stats.title }} />
          <Stack.Screen
            name="account"
            options={{ ...headerOptions, title: strings.account.title }}
          />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen
            name="tutorials/index"
            options={{ ...headerOptions, title: strings.tutorials.title }}
          />
          <Stack.Screen
            name="tutorials/[id]"
            options={{ ...headerOptions, title: strings.tutorials.title }}
          />
          {/* The timetable and its class editor draw their own top bars. */}
          <Stack.Screen name="timetable/index" />
          <Stack.Screen name="timetable/class/[id]" />
        </Stack>
        <AlphaExpiryNotice />
      </ToastProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  // True once the fonts loaded, failed or timed out (then the system font is used rather than hang).
  const ready = useAppFonts();
  // A shared alpha build stops opening on its expiry date (see app.config.js).
  const expired = useAlphaExpired();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <StartupScreen />;

  if (expired) {
    return (
      <ThemeProvider>
        <AlphaExpiredScreen />
      </ThemeProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DatabaseProvider>
          <ThemedStack />
        </DatabaseProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

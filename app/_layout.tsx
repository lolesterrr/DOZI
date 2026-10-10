import '../global.css';

import { useFonts } from 'expo-font';
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
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { useWeeklyMediaCleanup } from '@/features/media';
import { AppErrorScreen } from '@/features/shell';
import { strings } from '@/i18n/strings';
import { fontFamilies, ThemeProvider, useTheme } from '@/theme';
import { appFonts } from '@/theme/fonts';

// Keep the splash screen up until the fonts are ready, so text never flashes in the wrong font.
SplashScreen.preventAutoHideAsync();

// Expo Router shows this instead of the app when a screen throws while rendering.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorScreen {...props} />;
}

function ThemedStack() {
  const { colors, navigationTheme, scheme } = useTheme();
  useWeeklyMediaCleanup();
  // Pushed screens (search, folders) show a themed header with a back button.
  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.fg,
    headerTitleStyle: { fontFamily: fontFamilies.heading },
    headerShadowVisible: false,
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
          <Stack.Screen name="question/[id]" />
          <Stack.Screen name="questions" />
        </Stack>
      </ToastProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // If a font fails to load we still show the app (with the system font) rather than hang.
  if (!fontsLoaded && !fontError) return null;

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

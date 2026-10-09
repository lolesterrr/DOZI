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

import { ToastProvider } from '@/components/ui';
import { DatabaseProvider } from '@/db/DatabaseProvider';
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
          <Stack.Screen
            name="search"
            options={{
              headerShown: true,
              title: strings.search.title,
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.fg,
              headerTitleStyle: { fontFamily: fontFamilies.heading },
              headerShadowVisible: false,
            }}
          />
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
    <ThemeProvider>
      <DatabaseProvider>
        <ThemedStack />
      </DatabaseProvider>
    </ThemeProvider>
  );
}

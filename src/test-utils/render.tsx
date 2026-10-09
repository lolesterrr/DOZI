import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { ThemeProvider, type ThemePreference } from '@/theme';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Renders inside the same providers the app uses (theme, toast, safe area). */
export function renderWithProviders(
  ui: ReactElement,
  { theme = 'light' }: { theme?: ThemePreference } = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider initialPreference={theme}>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

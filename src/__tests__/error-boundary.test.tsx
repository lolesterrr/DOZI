import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorScreen } from '@/features/shell';
import { strings } from '@/i18n/strings';
import { addLogSink, type LogEntry } from '@/lib/logger';

const s = strings.errorBoundary;

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let shouldCrash = true;

function SometimesCrashes() {
  if (shouldCrash) throw new Error('boom');
  return <Text>screen works</Text>;
}

describe('app-wide error screen', () => {
  beforeEach(() => {
    // React reports caught render errors to console.error; keep the test output clean.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows Dozi’s error screen when a screen throws, logs it, and recovers on retry', async () => {
    const entries: LogEntry[] = [];
    const removeSink = addLogSink((entry) => entries.push(entry));
    shouldCrash = true;

    // app/_layout.tsx exports AppErrorScreen as its ErrorBoundary. The real layout waits for fonts
    // and imports global.css, so a plain Stack stands in for it here.
    await renderRouter(
      {
        _layout: {
          default: () => <Stack screenOptions={{ headerShown: false }} />,
          ErrorBoundary: AppErrorScreen,
        },
        index: SometimesCrashes,
      },
      {
        wrapper: ({ children }) => (
          <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
        ),
      },
    );

    expect(await screen.findByText(s.title)).toBeOnTheScreen();
    expect(screen.getByText(s.message)).toBeOnTheScreen();
    expect(screen.getByLabelText(strings.mascot.label)).toBeOnTheScreen();
    expect(entries.some((e) => e.level === 'error' && e.scope === 'error-boundary')).toBe(true);

    shouldCrash = false;
    await fireEvent.press(screen.getByRole('button', { name: s.retry }));
    expect(await screen.findByText('screen works')).toBeOnTheScreen();
    removeSink();
  });
});

import { act, render, renderHook, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { strings } from '@/i18n/strings';
import { addLogSink, type LogEntry } from '@/lib/logger';

import { StartupScreen } from '../components/StartupScreen';
import { FONT_TIMEOUT_MS, useAppFonts } from '../useAppFonts';

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));

const mockUseFonts = jest.mocked(useFonts);

describe('useAppFonts', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    // The hook logs a warning when it falls back to the system font; keep the test output clean.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    warnSpy.mockRestore();
    mockUseFonts.mockReset();
  });

  it('is ready as soon as the fonts load', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toBe(true);
  });

  it('is ready (system font) when a font fails to load', async () => {
    mockUseFonts.mockReturnValue([false, new Error('font missing')]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toBe(true);
  });

  it('stops waiting for slow fonts after the timeout and logs a warning', async () => {
    const entries: LogEntry[] = [];
    const removeSink = addLogSink((entry) => entries.push(entry));
    mockUseFonts.mockReturnValue([false, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(FONT_TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
    expect(entries.some((e) => e.level === 'warn' && e.scope === 'fonts')).toBe(true);
    removeSink();
  });
});

describe('StartupScreen', () => {
  it('shows a labelled spinner instead of a blank screen', async () => {
    await render(<StartupScreen />);
    expect(screen.getByLabelText(strings.startup)).toBeOnTheScreen();
  });
});

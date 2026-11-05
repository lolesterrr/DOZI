import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { STUDY_DAY_CHECK_MS, useStudyDay } from '../useStudyDay';

describe('useStudyDay', () => {
  let now: Date;
  const clock = () => now;

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the day before until 03:00 Kampala time, then moves on while the screen is open', async () => {
    // Friday 6 Nov 2026, 00:38 in Kampala (UTC+3): late-night study still counts for Thursday.
    now = new Date('2026-11-05T21:38:00Z');
    const { result } = await renderHook(() => useStudyDay('Africa/Kampala', clock));
    expect(result.current).toBe('2026-11-05');

    // 03:00 Friday in Kampala.
    now = new Date('2026-11-06T00:00:00Z');
    await act(async () => {
      jest.advanceTimersByTime(STUDY_DAY_CHECK_MS);
    });
    expect(result.current).toBe('2026-11-06');
  });

  it('catches up when the app comes back from the background', async () => {
    let onChange: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    now = new Date('2026-11-05T12:00:00Z');
    const { result } = await renderHook(() => useStudyDay('Africa/Kampala', clock));
    expect(result.current).toBe('2026-11-05');

    now = new Date('2026-11-06T09:00:00Z');
    await act(async () => onChange?.('active'));
    expect(result.current).toBe('2026-11-06');
  });
});

import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedSave } from '../hooks';

describe('useDebouncedSave (autosave)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('saves once, the last value, after typing stops', async () => {
    const save = jest.fn(async (_value: string) => {});
    const { result } = await renderHook(() => useDebouncedSave(save, 500));

    await act(async () => {
      result.current.schedule('a');
      jest.advanceTimersByTime(300);
      result.current.schedule('ab');
      jest.advanceTimersByTime(300);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.state).toBe('unsaved');

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('ab');
    expect(result.current.state).toBe('saved');
  });

  it('saves straight away on flush and when the screen closes', async () => {
    const save = jest.fn(async (_value: string) => {});
    const { result, unmount } = await renderHook(() => useDebouncedSave(save, 500));

    await act(async () => {
      result.current.schedule('now');
      await result.current.flush();
    });
    expect(save).toHaveBeenLastCalledWith('now');

    await act(async () => {
      result.current.schedule('on close');
    });
    await act(async () => unmount());
    expect(save).toHaveBeenLastCalledWith('on close');
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('reports a failed save and tries again on the next flush', async () => {
    const save = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDebouncedSave(save, 500));

    await act(async () => {
      result.current.schedule('text');
      await result.current.flush();
    });
    expect(result.current.state).toBe('error');

    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('text');
    expect(result.current.state).toBe('saved');
  });
});

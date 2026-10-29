import { applyPlan, type NotificationPort } from '../scheduler';
import type { PlannedNotification } from '../logic';

const n = (id: string): PlannedNotification => ({
  id,
  kind: 'daily',
  at: '2026-10-30T16:00:00.000Z',
  title: 'T',
  body: 'B',
});

describe('applyPlan', () => {
  it('clears what was scheduled, then schedules the plan in order', async () => {
    const calls: string[] = [];
    const port: NotificationPort = {
      cancelAll: async () => void calls.push('cancel'),
      schedule: async (x) => void calls.push(x.id),
    };
    await applyPlan([n('a'), n('b')], port);
    expect(calls).toEqual(['cancel', 'a', 'b']);
  });

  it('clears everything when the plan is empty (permission off, toggles off)', async () => {
    const cancelAll = jest.fn(async () => {});
    const schedule = jest.fn(async () => {});
    await applyPlan([], { cancelAll, schedule });
    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('keeps going when one notification fails to schedule', async () => {
    const scheduled: string[] = [];
    const port: NotificationPort = {
      cancelAll: async () => {},
      schedule: async (x) => {
        if (x.id === 'a') throw new Error('nope');
        scheduled.push(x.id);
      },
    };
    await applyPlan([n('a'), n('b')], port);
    expect(scheduled).toEqual(['b']);
  });
});

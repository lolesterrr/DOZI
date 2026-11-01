import type { PlannedNotification, WeeklyNotification } from '../logic';
import { applyPlan, phoneWeekday, type NotificationPort } from '../scheduler';

const n = (id: string): PlannedNotification => ({
  id,
  kind: 'daily',
  at: '2026-10-30T16:00:00.000Z',
  title: 'T',
  body: 'B',
});

const w = (id: string): WeeklyNotification => ({
  id,
  kind: 'lecture',
  weekday: 1,
  time: '07:30',
  title: 'T',
  body: 'B',
});

const fakePort = (calls: string[], failId?: string): NotificationPort => ({
  cancelAll: async () => void calls.push('cancel'),
  schedule: async (x) => {
    if (x.id === failId) throw new Error('nope');
    calls.push(x.id);
  },
  scheduleWeekly: async (x) => {
    if (x.id === failId) throw new Error('nope');
    calls.push(`weekly:${x.id}`);
  },
});

describe('applyPlan', () => {
  it('clears what was scheduled, then schedules the plan and the weekly reminders in order', async () => {
    const calls: string[] = [];
    await applyPlan([n('a'), n('b')], [w('c')], fakePort(calls));
    expect(calls).toEqual(['cancel', 'a', 'b', 'weekly:c']);
  });

  it('clears everything when the plan is empty (permission off, toggles off)', async () => {
    const calls: string[] = [];
    await applyPlan([], [], fakePort(calls));
    expect(calls).toEqual(['cancel']);
  });

  it('keeps going when one notification fails to schedule', async () => {
    const calls: string[] = [];
    await applyPlan([n('a'), n('b')], [w('x'), w('y')], fakePort(calls, 'x'));
    expect(calls).toEqual(['cancel', 'a', 'b', 'weekly:y']);
  });
});

describe('phoneWeekday', () => {
  it('turns Monday = 1 … Sunday = 7 into the phone’s Sunday = 1 … Saturday = 7', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(phoneWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });
});

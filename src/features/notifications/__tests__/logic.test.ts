import { defaultSettings } from '@/features/settings/logic';
import { localHour } from '@/lib/time';

import { isQuietTime, MAX_PER_DAY, planNotifications, type PlannerInput } from '../logic';

const TZ = 'Africa/Kampala';
// 2026-10-29 10:00 UTC is 13:00 Thursday in Kampala.
const NOW = '2026-10-29T10:00:00.000Z';

const base: PlannerInput = {
  now: NOW,
  timeZone: TZ,
  toggles: defaultSettings.notifications,
  reminderTime: '19:00',
  examDate: null,
  goalMet: false,
  todayCounted: false,
  streakDays: 0,
};

const plan = (over: Partial<PlannerInput> = {}) => planNotifications({ ...base, ...over });
const kinds = (list: ReturnType<typeof plan>) => list.map((n) => n.kind);
const localTime = (iso: string) => {
  const h = localHour(iso, TZ);
  return `${String(h).padStart(2, '0')}`;
};

describe('isQuietTime', () => {
  it.each([
    ['06:59', true],
    ['07:00', false],
    ['21:59', false],
    ['22:00', true],
    ['23:30', true],
    ['00:00', true],
    ['nonsense', true],
  ])('%s quiet: %s', (time, quiet) => expect(isQuietTime(time)).toBe(quiet));
});

describe('planNotifications', () => {
  it('plans the daily reminder for today and each coming day', () => {
    const list = plan();
    expect(kinds(list)).toEqual(Array(7).fill('daily'));
    expect(list[0].id).toBe('daily-2026-10-29');
    expect(list[0].at).toBe('2026-10-29T16:00:00.000Z'); // 19:00 in Kampala
  });

  it('drops today’s reminder once the daily goal is met, but keeps tomorrow’s', () => {
    const list = plan({ goalMet: true });
    expect(list).toHaveLength(6);
    expect(list[0].id).toBe('daily-2026-10-30');
  });

  it('drops a reminder time that has already passed today', () => {
    const list = plan({ now: '2026-10-29T17:00:00.000Z' }); // 20:00 local
    expect(list[0].id).toBe('daily-2026-10-30');
  });

  it('adds the 20:30 streak nudge only for a streak that is alive and not yet counted today', () => {
    const list = plan({ streakDays: 5 });
    const today = list.filter((n) => n.id.endsWith('2026-10-29'));
    expect(kinds(today)).toEqual(['daily', 'streak']);
    expect(today[1].at).toBe('2026-10-29T17:30:00.000Z');
    expect(today[1].body).toContain('5-day streak');

    const counted = plan({ streakDays: 5, todayCounted: true });
    expect(kinds(counted.filter((n) => n.id.endsWith('2026-10-29')))).toEqual(['daily']);
    expect(plan({ streakDays: 0 }).some((n) => n.kind === 'streak')).toBe(false);
  });

  it('skips the streak nudge when the reminder is already near 20:30', () => {
    const list = plan({ streakDays: 5, reminderTime: '20:15' });
    expect(list.some((n) => n.kind === 'streak')).toBe(false);
  });

  it('counts down to the exam 7, 3 and 1 days before, at 08:00', () => {
    // 7 days before was this morning (already past); 3 and 1 days before are still ahead.
    const list = plan({ examDate: '2026-11-05', toggles: { ...base.toggles, daily: false } });
    expect(list.map((n) => [n.id, n.title, n.at])).toEqual([
      ['exam-2026-11-02', 'Your exam is in 3 days', '2026-11-02T05:00:00.000Z'],
      ['exam-2026-11-04', 'Your exam is tomorrow', '2026-11-04T05:00:00.000Z'],
    ]);
  });

  it('never plans more than two a day, and the exam comes first', () => {
    const list = plan({ examDate: '2026-11-05', streakDays: 3 });
    const byDay = new Map<string, string[]>();
    for (const n of list) {
      const day = n.id.slice(-10);
      byDay.set(day, [...(byDay.get(day) ?? []), n.kind]);
    }
    for (const kindsOfDay of byDay.values()) {
      expect(kindsOfDay.length).toBeLessThanOrEqual(MAX_PER_DAY);
    }
    // Today's exam notice (08:00) is already past but still counts towards the day's two.
    expect(byDay.get('2026-10-29')).toEqual(['daily']);
    expect(byDay.get('2026-10-30')).toEqual(['daily', 'streak']);
    expect(byDay.get('2026-11-02')).toEqual(['exam', 'daily']); // the streak nudge is dropped
  });

  it('respects each toggle', () => {
    const off = { daily: false, streak: false, exam: false };
    expect(plan({ toggles: off, streakDays: 4, examDate: '2026-11-05' })).toEqual([]);
    expect(plan({ reminderTime: null })).toEqual([]);
  });

  it('never schedules inside quiet hours, even for a bad reminder time', () => {
    const list = plan({ reminderTime: '23:00', streakDays: 2 });
    for (const n of list) {
      const h = Number(localTime(n.at));
      expect(h >= 7 && h < 22).toBe(true);
    }
  });

  it('uses a calendar day, not the 03:00 study day, after midnight', () => {
    // 01:00 on the 30th in Kampala: still study day the 29th, calendar day the 30th.
    const list = plan({ now: '2026-10-29T22:00:00.000Z', goalMet: true });
    expect(list[0].id).toBe('daily-2026-10-30'); // today's goal belongs to yesterday's study day
  });
});

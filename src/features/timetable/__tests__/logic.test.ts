import {
  classDraftProblem,
  classesOn,
  emptyDraft,
  fromMinutes,
  gridRange,
  layoutDay,
  nowAndNext,
  parseReminders,
  planLectureReminders,
  reminderSlot,
  shiftWeekday,
  tidyDraft,
  toMinutes,
  totalMinutes,
  visibleWeekdays,
  weekdayOf,
  withStartTime,
  MAX_LECTURE_REMINDERS,
  type ClassDraft,
  type Reminder,
} from '../logic';

// SAMPLE timetable for tests only: made-up course names, no drug facts.
const cls = (
  id: string,
  weekday: number,
  startTime: string,
  endTime: string,
  reminders: Reminder[] = [],
) => ({
  id,
  title: `SAMPLE ${id}`,
  code: '',
  kind: 'lecture' as const,
  weekday,
  startTime,
  endTime,
  location: '',
  remindersJson: JSON.stringify(reminders),
});

describe('times and days', () => {
  it('converts times to minutes and back, wrapping round the day', () => {
    expect(toMinutes('08:30')).toBe(510);
    expect(fromMinutes(510)).toBe('08:30');
    expect(fromMinutes(-30)).toBe('23:30');
    expect(fromMinutes(24 * 60 + 5)).toBe('00:05');
  });

  it('uses Monday = 1 … Sunday = 7 and wraps round the week', () => {
    expect(weekdayOf('2026-11-02')).toBe(1); // a Monday
    expect(weekdayOf('2026-11-01')).toBe(7); // a Sunday
    expect(shiftWeekday(1, -1)).toBe(7);
    expect(shiftWeekday(7, 1)).toBe(1);
    expect(shiftWeekday(3, 9)).toBe(5);
  });
});

describe('reminders', () => {
  it('reads saved reminders forgivingly: drops junk and duplicates, keeps 3, earliest first', () => {
    const json = JSON.stringify([
      { type: 'before', minutes: 10 },
      { type: 'before', minutes: 10 },
      { type: 'nonsense' },
      { type: 'at', time: '20:00', dayOffset: -1 },
      { type: 'before', minutes: 60 },
      { type: 'before', minutes: 30 },
    ]);
    expect(parseReminders(json)).toEqual([
      { type: 'at', time: '20:00', dayOffset: -1 },
      { type: 'before', minutes: 60 },
      { type: 'before', minutes: 30 },
    ]);
    expect(parseReminders('not json')).toEqual([]);
    expect(parseReminders('{}')).toEqual([]);
  });

  it('puts a "minutes before" reminder on the same day', () => {
    expect(
      reminderSlot({ weekday: 2, startTime: '10:00' }, { type: 'before', minutes: 30 }),
    ).toEqual({ weekday: 2, time: '09:30', shifted: false });
  });

  it('puts the evening-before reminder on the day before, wrapping Monday to Sunday', () => {
    expect(
      reminderSlot(
        { weekday: 1, startTime: '08:00' },
        { type: 'at', time: '20:00', dayOffset: -1 },
      ),
    ).toEqual({ weekday: 7, time: '20:00', shifted: false });
  });

  it('moves a reminder out of quiet hours to 07:00 when the class is later', () => {
    expect(
      reminderSlot({ weekday: 3, startTime: '08:00' }, { type: 'before', minutes: 120 }),
    ).toEqual({ weekday: 3, time: '07:00', shifted: true });
    expect(
      reminderSlot(
        { weekday: 3, startTime: '08:00' },
        { type: 'at', time: '22:30', dayOffset: -1 },
      ),
    ).toEqual({ weekday: 3, time: '07:00', shifted: true });
  });

  it('drops a reminder that can’t avoid quiet hours or would come after the class starts', () => {
    expect(reminderSlot({ weekday: 3, startTime: '06:30' }, { type: 'before', minutes: 15 })).toBe(
      null,
    );
    expect(
      reminderSlot({ weekday: 3, startTime: '09:00' }, { type: 'at', time: '10:00', dayOffset: 0 }),
    ).toBe(null);
  });

  it('plans one weekly notification per reminder, soonest in the week first', () => {
    const plan = planLectureReminders([
      cls('b', 3, '14:00', '16:00', [{ type: 'before', minutes: 60 }]),
      cls('a', 1, '08:00', '10:00', [
        { type: 'before', minutes: 30 },
        { type: 'at', time: '20:00', dayOffset: -1 },
      ]),
    ]);
    expect(plan.map((n) => [n.id, n.weekday, n.time])).toEqual([
      ['lecture-a-b30', 1, '07:30'],
      ['lecture-b-b60', 3, '13:00'],
      ['lecture-a-a-120:00', 7, '20:00'],
    ]);
    expect(plan[0].title).toBe('SAMPLE a in 30 min');
    expect(plan[1].title).toBe('SAMPLE b in 1 h');
    expect(plan[2].title).toBe('Tomorrow: SAMPLE a');
    expect(plan[0].body).toContain('08:00');
  });

  it('never plans more than the phone can hold', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      cls(`c${i}`, (i % 5) + 1, '09:00', '10:00', [
        { type: 'before', minutes: 10 },
        { type: 'before', minutes: 30 },
      ]),
    );
    expect(planLectureReminders(many)).toHaveLength(MAX_LECTURE_REMINDERS);
  });
});

describe('the class editor', () => {
  const draft = (changes: Partial<ClassDraft> = {}): ClassDraft => ({
    ...emptyDraft(1),
    title: 'SAMPLE course',
    ...changes,
  });

  it('needs a name, a day and an end after the start', () => {
    expect(classDraftProblem(draft())).toBe(null);
    expect(classDraftProblem(draft({ title: '  ' }))).toBe('title');
    expect(classDraftProblem(draft({ weekdays: [] }))).toBe('days');
    expect(classDraftProblem(draft({ startTime: '10:00', endTime: '10:00' }))).toBe('times');
  });

  it('tidies the fields and the days', () => {
    const tidy = tidyDraft(draft({ title: '  SAMPLE  ', weekdays: [3, 1, 3] }));
    expect(tidy.title).toBe('SAMPLE');
    expect(tidy.weekdays).toEqual([1, 3]);
  });

  it('picks a colour not used yet for a new class', () => {
    expect(emptyDraft(1, ['teal', 'blue']).colour).toBe('violet');
  });

  it('keeps the length of the class when the start time moves', () => {
    expect(withStartTime(draft({ startTime: '08:00', endTime: '10:00' }), '14:00').endTime).toBe(
      '16:00',
    );
    expect(withStartTime(draft({ startTime: '08:00', endTime: '10:00' }), '23:00').endTime).toBe(
      '23:59',
    );
  });
});

describe('days, now and next', () => {
  const week = [
    cls('late', 1, '14:00', '16:00'),
    cls('early', 1, '08:00', '10:00'),
    cls('wed', 3, '11:00', '12:00'),
  ];

  it('lists a day’s classes earliest first', () => {
    expect(classesOn(week, 1).map((c) => c.id)).toEqual(['early', 'late']);
    expect(classesOn(week, 2)).toEqual([]);
  });

  it('shows Saturday and Sunday only when a class meets then', () => {
    expect(visibleWeekdays(week)).toEqual([1, 2, 3, 4, 5]);
    expect(visibleWeekdays([...week, cls('sat', 6, '09:00', '10:00')])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('finds the class on now and the next one', () => {
    const r = nowAndNext(week, { weekday: 1, minutes: toMinutes('09:00') });
    expect(r.current?.cls.id).toBe('early');
    expect(r.current?.progress).toBeCloseTo(0.5);
    expect(r.current?.minutesLeft).toBe(60);
    expect(r.next?.cls.id).toBe('late');
    expect(r.next?.minutesUntil).toBe(300);
  });

  it('looks into the following days, and round to next week', () => {
    const tue = nowAndNext(week, { weekday: 2, minutes: 600 });
    expect(tue.current).toBe(null);
    expect(tue.next).toMatchObject({ daysAhead: 1, minutesUntil: 24 * 60 + 60 });
    const fri = nowAndNext(week, { weekday: 5, minutes: 600 });
    expect(fri.next?.cls.id).toBe('early');
    expect(fri.next?.daysAhead).toBe(3);
    const mondayEvening = nowAndNext([cls('only', 1, '08:00', '09:00')], {
      weekday: 1,
      minutes: 1200,
    });
    expect(mondayEvening.next).toMatchObject({ daysAhead: 7 });
  });

  it('has nothing next for an empty timetable', () => {
    expect(nowAndNext([], { weekday: 1, minutes: 0 })).toEqual({ current: null, next: null });
  });

  it('adds up the teaching time', () => {
    expect(totalMinutes(week)).toBe(300);
  });
});

describe('the week grid', () => {
  it('shows 08:00–17:00 at least, stretched to fit early and late classes', () => {
    expect(gridRange([])).toEqual({ startHour: 8, endHour: 17 });
    expect(gridRange([cls('a', 1, '07:30', '08:30'), cls('b', 2, '17:00', '18:15')])).toEqual({
      startHour: 7,
      endHour: 19,
    });
  });

  it('puts overlapping classes side by side', () => {
    const range = { startHour: 8, endHour: 17 };
    const placed = layoutDay(
      [
        cls('a', 1, '08:00', '10:00'),
        cls('b', 1, '09:00', '11:00'),
        cls('c', 1, '10:00', '11:00'),
        cls('d', 1, '13:00', '14:00'),
      ],
      range,
    );
    const by = Object.fromEntries(placed.map((p) => [p.cls.id, p]));
    expect(by.a).toMatchObject({ top: 0, length: 120, lane: 0, lanes: 2 });
    expect(by.b).toMatchObject({ top: 60, lane: 1, lanes: 2 });
    expect(by.c).toMatchObject({ lane: 0, lanes: 2 });
    expect(by.d).toMatchObject({ top: 300, lane: 0, lanes: 1 });
  });
});

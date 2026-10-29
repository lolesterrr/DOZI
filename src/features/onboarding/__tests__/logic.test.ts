import {
  defaultDraft,
  draftFromProfile,
  examDateFromPreset,
  isAllowedReminder,
  nextStep,
  onboardingSteps,
  parseOnboardingRecord,
  presetForExamDate,
  previousStep,
  profileChangesFromDraft,
  reminderTimes,
  stepFraction,
  yearStepComplete,
} from '../logic';

describe('steps', () => {
  it('walks forward and back through the flow', () => {
    expect(nextStep('welcome')).toBe('year');
    expect(nextStep('account')).toBeNull();
    expect(previousStep('welcome')).toBeNull();
    expect(previousStep('goal')).toBe('year');
    expect(stepFraction('welcome')).toBe(0);
    expect(stepFraction('account')).toBe(1);
    expect(onboardingSteps).toHaveLength(6);
  });
});

describe('reminders', () => {
  it('offers half-hour times from 07:00 to 21:30 only', () => {
    const times = reminderTimes();
    expect(times[0]).toBe('07:00');
    expect(times[times.length - 1]).toBe('21:30');
    expect(times).toContain('19:00');
    expect(times.every(isAllowedReminder)).toBe(true);
  });

  it.each([
    ['06:59', false],
    ['07:00', true],
    ['21:30', true],
    ['22:00', false],
    ['23:30', false],
    ['3pm', false],
    ['25:00', false],
  ])('%s allowed: %s', (time, allowed) => {
    expect(isAllowedReminder(time)).toBe(allowed);
  });
});

describe('exam presets', () => {
  it('turns a rough answer into a date and back', () => {
    const date = examDateFromPreset('oneMonth', '2026-10-29');
    expect(date).toBe('2026-11-28');
    expect(presetForExamDate(date, '2026-10-29')).toBe('oneMonth');
    expect(presetForExamDate('2027-01-01', '2026-10-29')).toBeNull();
    expect(presetForExamDate(null, '2026-10-29')).toBeNull();
  });
});

describe('year and semester', () => {
  it('must be chosen together or not at all', () => {
    expect(yearStepComplete(defaultDraft)).toBe(true);
    expect(yearStepComplete({ ...defaultDraft, year: 2 })).toBe(false);
    expect(yearStepComplete({ ...defaultDraft, year: 2, semester: 1 })).toBe(true);
    expect(yearStepComplete({ ...defaultDraft, semester: 1 })).toBe(false);
  });
});

describe('profileChangesFromDraft', () => {
  it('saves the answers', () => {
    expect(
      profileChangesFromDraft({
        year: 3,
        semester: 2,
        goalXp: 100,
        reminder: '19:30',
        examDate: '2027-02-01',
      }),
    ).toEqual({
      yearOfStudy: 3,
      semester: 2,
      dailyGoalXp: 100,
      reminderTime: '19:30',
      examDate: '2027-02-01',
    });
  });

  it('drops anything invalid instead of saving it', () => {
    expect(
      profileChangesFromDraft({
        year: 9,
        semester: 3,
        goalXp: 77,
        reminder: '23:00',
        examDate: 'soon',
      }),
    ).toEqual({
      yearOfStudy: null,
      semester: null,
      dailyGoalXp: 50,
      reminderTime: null,
      examDate: null,
    });
  });
});

describe('draftFromProfile', () => {
  it('starts from the saved profile, or the defaults', () => {
    expect(draftFromProfile(undefined)).toEqual(defaultDraft);
    expect(
      draftFromProfile({
        yearOfStudy: 2,
        semester: 1,
        dailyGoalXp: 20,
        reminderTime: null,
        examDate: '2027-02-01',
      }),
    ).toEqual({ year: 2, semester: 1, goalXp: 20, reminder: null, examDate: '2027-02-01' });
  });
});

describe('parseOnboardingRecord', () => {
  it('reads the saved setting and ignores junk', () => {
    expect(parseOnboardingRecord({ at: 'x', skipped: true })).toEqual({ at: 'x', skipped: true });
    expect(parseOnboardingRecord({ at: 'x' })).toEqual({ at: 'x', skipped: false });
    expect(parseOnboardingRecord(undefined)).toBeNull();
    expect(parseOnboardingRecord('done')).toBeNull();
  });
});

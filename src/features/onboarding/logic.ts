import { addDays, isDayString, type DayString } from '@/lib/time';

// Pure rules for onboarding (PRODUCT_SPEC §3, task 2.8): the steps, the choices on each, and how
// the answers become profile changes. No React and no database.

export const onboardingSteps = ['welcome', 'year', 'goal', 'reminder', 'exam', 'account'] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export const YEARS = [1, 2, 3, 4, 5] as const;
export const SEMESTERS = [1, 2] as const;

/** The daily goal choices (PRODUCT_SPEC §3). */
export const goalChoices = [
  { key: 'casual', xp: 20 },
  { key: 'regular', xp: 50 },
  { key: 'serious', xp: 100 },
  { key: 'intense', xp: 150 },
] as const;
export type GoalKey = (typeof goalChoices)[number]['key'];

export const DEFAULT_GOAL_XP = 50;
export const DEFAULT_REMINDER = '19:00';

/** Reminders are never sent in the quiet hours, 22:00 to 07:00 (CLAUDE.md non-negotiable 9). */
export const FIRST_REMINDER_MINUTES = 7 * 60;
export const LAST_REMINDER_MINUTES = 21 * 60 + 30;

/** "HH:mm" every 30 minutes from 07:00 to 21:30. */
export function reminderTimes(): string[] {
  const out: string[] = [];
  for (let m = FIRST_REMINDER_MINUTES; m <= LAST_REMINDER_MINUTES; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

export function isAllowedReminder(time: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return (
    Number(match[1]) < 24 &&
    Number(match[2]) < 60 &&
    minutes >= FIRST_REMINDER_MINUTES &&
    minutes <= LAST_REMINDER_MINUTES
  );
}

/** "Roughly when is your exam?" answers; the exact date can be set later in the planner. */
export const examPresets = [
  { key: 'twoWeeks', days: 14 },
  { key: 'oneMonth', days: 30 },
  { key: 'twoMonths', days: 61 },
  { key: 'threeMonths', days: 91 },
  { key: 'fourMonths', days: 122 },
  { key: 'sixMonths', days: 183 },
] as const;
export type ExamPresetKey = (typeof examPresets)[number]['key'];

export function examDateFromPreset(key: ExamPresetKey, today: DayString): DayString {
  const preset = examPresets.find((p) => p.key === key);
  if (!preset) throw new Error(`Unknown exam preset ${key}`);
  return addDays(today, preset.days);
}

/** Which preset (if any) a saved date was chosen from, for showing it selected when re-running. */
export function presetForExamDate(date: DayString | null, today: DayString): ExamPresetKey | null {
  if (!date) return null;
  const match = examPresets.find((p) => addDays(today, p.days) === date);
  return match?.key ?? null;
}

/** The answers so far. */
export type OnboardingDraft = {
  year: number | null;
  semester: number | null;
  goalXp: number;
  /** "HH:mm", or null for no reminder. */
  reminder: string | null;
  examDate: DayString | null;
};

export const defaultDraft: OnboardingDraft = {
  year: null,
  semester: null,
  goalXp: DEFAULT_GOAL_XP,
  reminder: DEFAULT_REMINDER,
  examDate: null,
};

type ProfileLike = {
  yearOfStudy: number | null;
  semester: number | null;
  dailyGoalXp: number;
  reminderTime: string | null;
  examDate: string | null;
};

/** Starts the flow from what the profile already holds (re-running onboarding from Me). */
export function draftFromProfile(profile: ProfileLike | undefined): OnboardingDraft {
  if (!profile) return defaultDraft;
  return {
    year: profile.yearOfStudy,
    semester: profile.semester,
    goalXp: profile.dailyGoalXp,
    reminder: profile.reminderTime,
    examDate: profile.examDate && isDayString(profile.examDate) ? profile.examDate : null,
  };
}

/** What gets saved on the profile. Unanswered optional questions are saved as empty. */
export function profileChangesFromDraft(draft: OnboardingDraft) {
  return {
    yearOfStudy:
      draft.year && (YEARS as readonly number[]).includes(draft.year) ? draft.year : null,
    semester:
      draft.semester && (SEMESTERS as readonly number[]).includes(draft.semester)
        ? draft.semester
        : null,
    dailyGoalXp: goalChoices.some((g) => g.xp === draft.goalXp) ? draft.goalXp : DEFAULT_GOAL_XP,
    reminderTime: draft.reminder && isAllowedReminder(draft.reminder) ? draft.reminder : null,
    examDate: draft.examDate && isDayString(draft.examDate) ? draft.examDate : null,
  };
}

/** The step after / before `step`, or null at the ends. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return onboardingSteps[onboardingSteps.indexOf(step) + 1] ?? null;
}
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return onboardingSteps[onboardingSteps.indexOf(step) - 1] ?? null;
}

/** 0…1 for the progress bar (the welcome screen is 0, the last step is 1). */
export function stepFraction(step: OnboardingStep): number {
  return onboardingSteps.indexOf(step) / (onboardingSteps.length - 1);
}

/** The year and semester must be picked together or not at all. */
export function yearStepComplete(draft: OnboardingDraft): boolean {
  return (draft.year === null) === (draft.semester === null);
}

/** The setting that says onboarding has been done or skipped. */
export const ONBOARDING_SETTING = 'onboarding_done';
export type OnboardingRecord = { at: string; skipped: boolean };

export function parseOnboardingRecord(value: unknown): OnboardingRecord | null {
  if (!value || typeof value !== 'object') return null;
  const { at, skipped } = value as Record<string, unknown>;
  return typeof at === 'string' ? { at, skipped: skipped === true } : null;
}

import { strings } from '@/i18n/strings';

import type { DoziMood } from './moods';

// What Monsieur Pierre says, by situation (PRODUCT_SPEC §9). The lines themselves are in i18n/strings.ts
// (strings.mascot.messages); this file picks one and says how he looks while saying it.
// Voice: short, warm, lightly funny, never shaming. Nothing here states a drug fact.

export const mascotContexts = [
  'greetingMorning',
  'greetingDay',
  'greetingEvening',
  'greetingLate',
  'correct',
  'wrong',
  'streakAtRisk',
  'streakLost',
  'streakKept',
  'goalReached',
  'sessionDone',
  'quizPassed',
  'quizNotYet',
  'nothingDue',
  'emptyState',
  'error',
  'welcomeBack',
] as const;
export type MascotContext = (typeof mascotContexts)[number];

/** Pierre's face for each situation. */
const moodFor: Record<MascotContext, DoziMood> = {
  greetingMorning: 'happy',
  greetingDay: 'idle',
  greetingEvening: 'idle',
  greetingLate: 'sleepy',
  correct: 'happy',
  wrong: 'encouraging',
  streakAtRisk: 'concerned',
  streakLost: 'encouraging',
  streakKept: 'proud',
  goalReached: 'celebrating',
  sessionDone: 'proud',
  quizPassed: 'celebrating',
  quizNotYet: 'encouraging',
  nothingDue: 'happy',
  emptyState: 'thinking',
  error: 'surprised',
  welcomeBack: 'happy',
};

export function messageMood(context: MascotContext): DoziMood {
  return moodFor[context];
}

/**
 * One line for the situation. The same `seed` always gives the same line (so a screen doesn't
 * change its words when it redraws); pass something that changes, like the study day number or a
 * question number, to vary it.
 */
export function pickMessage(context: MascotContext, seed = 0): string {
  const lines = strings.mascot.messages[context];
  const index = ((Math.trunc(seed) % lines.length) + lines.length) % lines.length;
  return lines[index];
}

/**
 * Which greeting fits the hour of the day (0–23, in the student's timezone; use src/lib/time.ts
 * to get it). Late evening and night get the sleepy Dozi, in step with the 22:00 quiet hours.
 */
export function greetingContext(hour: number): MascotContext {
  if (hour >= 22 || hour < 5) return 'greetingLate';
  if (hour < 12) return 'greetingMorning';
  if (hour < 17) return 'greetingDay';
  return 'greetingEvening';
}

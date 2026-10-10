import { FIELD_IMAGES_MAX, FIELD_TEXT_MAX } from '@/features/decks/logic';
import { strings } from '@/i18n/strings';

import {
  BLANKS_MAX,
  MIN_OPTIONS,
  MIN_PAIRS,
  QUIZ_TITLE_MAX,
  quizTitleProblem,
  type QuestionProblem,
} from './logic';

/** An error message for a quiz title, or null when it's fine. */
export function quizTitleMessage(title: string): string | null {
  const problem = quizTitleProblem(title);
  if (problem === 'empty') return strings.quizzes.titleProblems.empty;
  if (problem === 'tooLong') return strings.quizzes.titleProblems.tooLong(QUIZ_TITLE_MAX);
  return null;
}

/** What to tell the student when a question can't be saved yet. */
export function questionProblemMessage(problem: QuestionProblem): string {
  const p = strings.questions.problems;
  switch (problem) {
    case 'tooLong':
      return p.tooLong(FIELD_TEXT_MAX);
    case 'tooManyImages':
      return p.tooManyImages(FIELD_IMAGES_MAX);
    case 'tooFewOptions':
      return p.tooFewOptions(MIN_OPTIONS);
    case 'tooManyBlanks':
      return p.tooManyBlanks(BLANKS_MAX);
    case 'tooFewPairs':
      return p.tooFewPairs(MIN_PAIRS);
    default:
      return p[problem];
  }
}

/** A, B, C… for option labels. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

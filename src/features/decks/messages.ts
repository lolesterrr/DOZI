import { strings } from '@/i18n/strings';

import { DECK_TITLE_MAX, deckTitleProblem } from './logic';

/** An error message for a deck title, or null when it's fine. */
export function deckTitleMessage(title: string): string | null {
  const problem = deckTitleProblem(title);
  if (problem === 'empty') return strings.decks.titleProblems.empty;
  if (problem === 'tooLong') return strings.decks.titleProblems.tooLong(DECK_TITLE_MAX);
  return null;
}

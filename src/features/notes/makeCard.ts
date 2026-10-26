// Pure rules for "Make card" in a note (task 1.13, PRODUCT_SPEC §4.1): turning the text the
// student selected into the start of a basic or cloze card. No React, no editor, no database.

/** The most text a card field takes (the card editor's limit, decks/logic FIELD_TEXT_MAX). */
export const SELECTION_TEXT_MAX = 5000;

/** How much of the paragraph around the selection the editor sends, on each side. */
export const SELECTION_CONTEXT_MAX = 1000;

/** A paragraph up to this long goes into a cloze whole; a longer one is cut to the sentence. */
export const CLOZE_CONTEXT_WHOLE_MAX = 600;

/**
 * The text selected in a note, as the editor reports it. `before`/`after` are the rest of the
 * paragraph (or list item, heading, table cell) around the selection, when the selection is
 * inside one; null when it spans several blocks.
 */
export type NoteTextSelection = { text: string; before: string | null; after: string | null };

export type NoteCardType = 'basic' | 'cloze';

export const noteCardTypes: readonly NoteCardType[] = ['basic', 'cloze'];

export function isNoteCardType(value: unknown): value is NoteCardType {
  return value === 'basic' || value === 'cloze';
}

/** True when there is something to make a card from. */
export function hasSelectedText(selection: NoteTextSelection | null | undefined): boolean {
  return !!selection && cleanSelectedText(selection.text) !== '';
}

/** Non-breaking spaces become spaces, line ends are trimmed, blank-line runs shrink to one. */
export function cleanSelectedText(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The card's first field (front, or cloze text) for the selection.
 *  - Basic: the selected text; the student writes the back.
 *  - Cloze, inside one paragraph: the paragraph (or, when it is long, the sentence) with the
 *    selection hidden as `{{c1::…}}`.
 *  - Cloze across several paragraphs: the selected text without markers; the student marks the
 *    answers with the cloze button.
 * `tooLong` says the text was cut to fit a card field.
 */
export function cardTextFromSelection(
  selection: NoteTextSelection,
  type: NoteCardType,
): { text: string; tooLong: boolean } {
  const plain = cleanSelectedText(selection.text);
  if (type === 'cloze') {
    const cloze = clozeInContext(selection);
    if (cloze !== null) return { text: cloze, tooLong: false };
  }
  return plain.length > SELECTION_TEXT_MAX
    ? { text: plain.slice(0, SELECTION_TEXT_MAX).trimEnd(), tooLong: true }
    : { text: plain, tooLong: false };
}

function clozeInContext({ text, before, after }: NoteTextSelection): string | null {
  if (before === null || after === null) return null;
  const answer = cleanSelectedText(text);
  // One line only, and nothing that would break the {{c1::…}} markers.
  if (!answer || answer.includes('\n') || /\{\{|\}\}|::/.test(answer)) return null;
  // Spaces selected at either end stay outside the marker.
  const lead = /^\s*/.exec(text)?.[0] ?? '';
  const trail = /\s*$/.exec(text)?.[0] ?? '';
  let left = clean(before + lead);
  let right = clean(trail + after);
  if (/\{\{|\}\}/.test(left + right)) return null;
  if (left.length + right.length > CLOZE_CONTEXT_WHOLE_MAX) {
    left = sentenceStart(left);
    right = sentenceEnd(right);
  }
  const result = `${left.trimStart()}{{c1::${answer}}}${right.trimEnd()}`;
  return result.length <= SELECTION_TEXT_MAX ? result : `{{c1::${answer}}}`;
}

function clean(text: string): string {
  return text.replace(/ /g, ' ').replace(/\s*\n\s*/g, ' ');
}

/** Words longer than this on one side of a sentence are cut with "…". */
const SIDE_MAX = CLOZE_CONTEXT_WHOLE_MAX / 2;

/** The part of `before` that belongs to the selection's sentence. */
export function sentenceStart(before: string): string {
  const ends = [...before.matchAll(/[.!?]["')\]]?\s+/g)];
  const last = ends[ends.length - 1];
  let start = last ? before.slice((last.index ?? 0) + last[0].length) : before;
  if (start.length > SIDE_MAX) {
    const cut = start.slice(start.length - SIDE_MAX);
    const space = cut.indexOf(' ');
    start = `…${space >= 0 ? cut.slice(space) : cut}`;
  }
  return start;
}

/** The part of `after` that belongs to the selection's sentence (with its full stop). */
export function sentenceEnd(after: string): string {
  const end = /[.!?]["')\]]?(?=\s|$)/.exec(after);
  let rest = end ? after.slice(0, end.index + end[0].length) : after;
  if (rest.length > SIDE_MAX) {
    const cut = rest.slice(0, SIDE_MAX);
    const space = cut.lastIndexOf(' ');
    rest = `${space > 0 ? cut.slice(0, space) : cut}…`;
  }
  return rest;
}

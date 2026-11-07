import type { CardDraft } from '@/features/decks/logic';

import type { DocNode } from './logic';
import { docToText } from './logic';
import { text } from './templates';

// The mnemonic maker (task 1.14c). Pure, so it is unit-tested.
//
// The student lists what to remember, in order. Dozi shows the first letter of each, the student
// writes a phrase whose words start with those letters, and the result goes into the note as a
// mnemonic box and into a deck as 2 cards.

export const MNEMONIC_ITEMS_MIN = 2;
export const MNEMONIC_ITEMS_MAX = 12;
export const MNEMONIC_ITEM_MAX = 80;

/** The things to remember: one per line, with list markers (`- `, `1. `, `•`) taken off. */
export function mnemonicItems(input: string): string[] {
  return input
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MNEMONIC_ITEM_MAX),
    )
    .filter((line) => /[\p{L}\p{N}]/u.test(line));
}

/** The first letter or digit of a word or item, in capitals ("" when it has none). */
export function firstLetter(value: string): string {
  const match = /[\p{L}\p{N}]/u.exec(value);
  return match ? match[0].toLocaleUpperCase() : '';
}

export type LetterMatch = { letter: string; word: string | null; ok: boolean };

export type PhraseCheck = {
  letters: LetterMatch[];
  /** Words after the last letter. */
  extra: number;
  /** Every letter has a matching word and there are no extra words. */
  complete: boolean;
};

/** Checks each word of the phrase against the letter it should start with. */
export function checkPhrase(items: readonly string[], phrase: string): PhraseCheck {
  const words = phrase.split(/\s+/).filter((word) => firstLetter(word) !== '');
  const letters = items.map((item, i) => {
    const letter = firstLetter(item);
    const word = words[i] ?? null;
    return { letter, word, ok: word !== null && firstLetter(word) === letter };
  });
  const extra = Math.max(0, words.length - items.length);
  return { letters, extra, complete: letters.every((l) => l.ok) && extra === 0 };
}

/** Lists in a note that could be a mnemonic: 2 to 12 items, in the order they appear. */
export function noteLists(doc: DocNode): string[][] {
  const lists: string[][] = [];
  const walk = (node: DocNode) => {
    if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const items = (node.content ?? [])
        .map((item) => docToText({ type: 'doc', content: item.content ?? [] }).split('\n')[0])
        .flatMap((line) => mnemonicItems(line ?? ''));
      if (items.length >= MNEMONIC_ITEMS_MIN && items.length <= MNEMONIC_ITEMS_MAX) {
        lists.push(items);
      }
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return lists;
}

const cleanPhrase = (phrase: string) => phrase.replace(/\s+/g, ' ').trim();

const bold = (value: string): DocNode => ({ ...text(value), marks: [{ type: 'bold' }] });

/** The mnemonic box added to the note: the phrase in bold, then each letter and its meaning. */
export function mnemonicCallout(name: string, items: readonly string[], phrase: string): DocNode {
  const intro: DocNode[] = name.trim() ? [text(`${name.trim()}: `)] : [];
  return {
    type: 'callout',
    attrs: { kind: 'mnemonic' },
    content: [
      { type: 'paragraph', content: [...intro, bold(cleanPhrase(phrase))] },
      {
        type: 'bulletList',
        content: items.map((item) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [bold(firstLetter(item)), text(` – ${item}`)] }],
        })),
      },
    ],
  };
}

/** The note with the mnemonic box added at the end. */
export function appendBlock(doc: DocNode, block: DocNode): DocNode {
  return { ...doc, content: [...(doc.content ?? []), block] };
}

/** Two basic cards: one asks for the phrase, one asks what it stands for. */
export function mnemonicCards(
  name: string,
  items: readonly string[],
  phrase: string,
  copy: { asksPhrase: (name: string) => string; asksMeaning: (phrase: string) => string },
): CardDraft[] {
  const clean = cleanPhrase(phrase);
  const list = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const field = (value: string) => ({ text: value, mediaIds: [] });
  return [
    {
      type: 'basic',
      front: field(copy.asksPhrase(name.trim())),
      back: field(clean),
      extra: field(list),
    },
    {
      type: 'basic',
      front: field(copy.asksMeaning(clean)),
      back: field(list),
      extra: field(''),
    },
  ];
}

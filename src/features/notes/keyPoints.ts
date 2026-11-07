import { docToText, type DocNode } from './logic';

// The "key points in your cards" meter (task 1.14d). Pure, so it is unit-tested.
//
// A note's key points are its sections: each heading with something written under it. A note
// with no headings counts each paragraph or list item as a point instead. A point is "in your
// cards" when a card made from this note (`cards.source_note_id`) holds text from it: cards
// made with "Make card" copy the selected text, so a plain text match finds them, and a
// looser word match still finds cards the student reworded a little.

export type KeyPoint = {
  /** The heading, or the start of the paragraph for a note without headings. */
  title: string;
  /** All the text of the point (heading and what's under it). */
  text: string;
};

/** The most points a note shows, so a very long note doesn't make an endless list. */
export const KEY_POINTS_MAX = 40;

const inlineText = (node: DocNode): string => docToText({ type: 'doc', content: [node] });

const shorten = (text: string, max = 80) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

/** The key points of a note, in order. */
export function noteKeyPoints(doc: DocNode): KeyPoint[] {
  const blocks = doc.content ?? [];
  const hasHeadings = blocks.some((b) => b.type === 'heading' && inlineText(b).trim());
  const points: KeyPoint[] = [];

  if (hasHeadings) {
    let current: { title: string; parts: string[] } | null = null;
    const finish = () => {
      if (!current) return;
      const body = current.parts.join('\n').trim();
      if (body) points.push({ title: current.title, text: `${current.title}\n${body}` });
      current = null;
    };
    for (const block of blocks) {
      if (block.type === 'heading') {
        finish();
        const title = shorten(inlineText(block));
        current = title ? { title, parts: [] } : null;
        continue;
      }
      // Text before the first heading (e.g. "Class · Date · Lecturer") isn't a point.
      current?.parts.push(inlineText(block));
    }
    finish();
  } else {
    const add = (text: string) => {
      if (text.trim()) points.push({ title: shorten(text), text: text.trim() });
    };
    for (const block of blocks) {
      if (
        block.type === 'bulletList' ||
        block.type === 'orderedList' ||
        block.type === 'taskList'
      ) {
        for (const item of block.content ?? []) add(inlineText(item));
      } else {
        add(inlineText(block));
      }
    }
  }
  return points.slice(0, KEY_POINTS_MAX);
}

/** Lower case, cloze markers and punctuation gone, one space between words. */
export function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const words = (text: string) =>
  normaliseForMatch(text)
    .split(' ')
    .filter((w) => w.length >= 3);

/** Long enough that finding it in a point isn't luck: two words or more, or one long word. */
const isSpecific = (text: string) => (text.includes(' ') ? text.length >= 6 : text.length >= 10);

/** True when a card's text comes from this point. */
export function cardCoversPoint(
  card: { frontText: string; backText: string },
  point: KeyPoint,
): boolean {
  const pointText = ` ${normaliseForMatch(point.text)} `;
  for (const side of [card.frontText, card.backText]) {
    const text = normaliseForMatch(side);
    if (isSpecific(text) && pointText.includes(` ${text} `)) return true;
  }
  // Reworded cards: most of the front's words appear in the point.
  const front = words(card.frontText);
  if (front.length < 3) return false;
  const pointWords = new Set(words(point.text));
  const shared = front.filter((w) => pointWords.has(w)).length;
  return shared / front.length >= 0.6;
}

export type KeyPointProgress = {
  points: { point: KeyPoint; covered: boolean }[];
  covered: number;
  total: number;
};

/** Which key points of a note are already in its cards. */
export function keyPointProgress(
  doc: DocNode,
  cards: readonly { frontText: string; backText: string }[],
): KeyPointProgress {
  const points = noteKeyPoints(doc).map((point) => ({
    point,
    covered: cards.some((card) => cardCoversPoint(card, point)),
  }));
  return {
    points,
    covered: points.filter((p) => p.covered).length,
    total: points.length,
  };
}

/**
 * True when this change finished the note: every point is now in a card, and it wasn't before.
 * Notes with fewer than 2 points don't count, so one card on a one-line note isn't a celebration.
 */
export function justCompleted(
  before: Pick<KeyPointProgress, 'covered' | 'total'> | null,
  now: Pick<KeyPointProgress, 'covered' | 'total'>,
): boolean {
  if (!before || now.total < 2 || now.covered < now.total) return false;
  return before.covered < before.total || before.total < now.total;
}

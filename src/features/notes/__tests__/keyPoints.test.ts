import {
  cardCoversPoint,
  justCompleted,
  keyPointProgress,
  KEY_POINTS_MAX,
  normaliseForMatch,
  noteKeyPoints,
} from '../keyPoints';
import type { DocNode } from '../logic';

const text = (value: string): DocNode => ({ type: 'text', text: value });
const p = (value: string): DocNode => ({ type: 'paragraph', content: value ? [text(value)] : [] });
const h = (value: string): DocNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: value ? [text(value)] : [],
});
const list = (...items: string[]): DocNode => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });

const card = (frontText: string, backText = '') => ({ frontText, backText });

describe('noteKeyPoints', () => {
  it('makes one point per heading with something under it', () => {
    const points = noteKeyPoints(
      doc(
        p('Class · Date · Lecturer'),
        h('In one line'),
        p('Find an item in a sorted list by halving.'),
        h('Empty heading'),
        p(''),
        h('Key numbers'),
        list('Time: O(log n)', 'Space: O(1)'),
      ),
    );
    expect(points.map((point) => point.title)).toEqual(['In one line', 'Key numbers']);
    expect(points[1].text).toBe('Key numbers\nTime: O(log n)\nSpace: O(1)');
  });

  it('uses paragraphs and list items when the note has no headings', () => {
    const points = noteKeyPoints(doc(p('First idea.'), p(' '), list('Second', 'Third')));
    expect(points.map((point) => point.text)).toEqual(['First idea.', 'Second', 'Third']);
  });

  it('shortens long titles and caps the number of points', () => {
    const long = 'word '.repeat(40);
    const points = noteKeyPoints(doc(...Array.from({ length: 50 }, () => p(long))));
    expect(points).toHaveLength(KEY_POINTS_MAX);
    expect(points[0].title.length).toBeLessThanOrEqual(80);
    expect(points[0].title.endsWith('…')).toBe(true);
  });

  it('has no points for an empty note', () => {
    expect(noteKeyPoints(doc())).toEqual([]);
    expect(noteKeyPoints({ type: 'doc' })).toEqual([]);
  });
});

describe('normaliseForMatch', () => {
  it('drops case, cloze markers and punctuation', () => {
    expect(normaliseForMatch('The {{c1::Liver}} makes {{c2::bile::fluid}}!')).toBe(
      'the liver makes bile',
    );
  });
});

describe('cardCoversPoint', () => {
  const point = {
    title: 'How it works',
    text: 'How it works\nLook at the middle item.\nToo big? Search the left half.',
  };

  it('finds copied text on either side of the card', () => {
    expect(
      cardCoversPoint(card('What do you do when it is too big?', 'Search the left half'), point),
    ).toBe(true);
    expect(cardCoversPoint(card('Look at the {{c1::middle}} item'), point)).toBe(true);
  });

  it('finds a card the student reworded a little', () => {
    expect(cardCoversPoint(card('First look at middle item, then search left half'), point)).toBe(
      true,
    );
  });

  it('ignores cards from somewhere else and tiny matches', () => {
    expect(cardCoversPoint(card('What is the capital of Uganda?', 'Kampala'), point)).toBe(false);
    expect(cardCoversPoint(card('Q', 'half'), point)).toBe(false);
  });

  it('only matches whole words', () => {
    expect(cardCoversPoint(card('ook at the midd'), point)).toBe(false);
  });
});

describe('keyPointProgress', () => {
  it('counts the points that are in cards', () => {
    const note = doc(h('One'), p('Alpha beta gamma delta.'), h('Two'), p('Epsilon zeta eta.'));
    const progress = keyPointProgress(note, [card('Alpha beta gamma delta')]);
    expect(progress.covered).toBe(1);
    expect(progress.total).toBe(2);
    expect(progress.points.map((point) => point.covered)).toEqual([true, false]);
  });
});

describe('justCompleted', () => {
  it('is true only when this change finished the note', () => {
    expect(justCompleted({ covered: 1, total: 2 }, { covered: 2, total: 2 })).toBe(true);
    expect(justCompleted({ covered: 2, total: 2 }, { covered: 2, total: 2 })).toBe(false);
    expect(justCompleted(null, { covered: 2, total: 2 })).toBe(false);
    expect(justCompleted({ covered: 0, total: 1 }, { covered: 1, total: 1 })).toBe(false);
    expect(justCompleted({ covered: 1, total: 2 }, { covered: 1, total: 2 })).toBe(false);
  });
});

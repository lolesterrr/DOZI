import {
  appendBlock,
  checkPhrase,
  firstLetter,
  mnemonicCallout,
  mnemonicCards,
  mnemonicItems,
  noteLists,
} from '../mnemonic';
import { docToText, type DocNode } from '../logic';

const p = (value: string): DocNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text: value }],
});
const list = (type: string, ...items: string[]): DocNode => ({
  type,
  content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});

describe('mnemonicItems', () => {
  it('takes one item per line and drops list markers and blank lines', () => {
    expect(mnemonicItems('- Physical\n\n2. Data link\n•  Network  \n---')).toEqual([
      'Physical',
      'Data link',
      'Network',
    ]);
  });
});

describe('firstLetter', () => {
  it('skips punctuation and works beyond English', () => {
    expect(firstLetter('"apple')).toBe('A');
    expect(firstLetter('éclair')).toBe('É');
    expect(firstLetter('3D')).toBe('3');
    expect(firstLetter('…')).toBe('');
  });
});

describe('checkPhrase', () => {
  const items = ['Physical', 'Data link', 'Network'];

  it('matches each word to its letter', () => {
    const check = checkPhrase(items, 'Please do Not');
    expect(check.complete).toBe(true);
    expect(check.letters.map((l) => l.letter)).toEqual(['P', 'D', 'N']);
  });

  it('marks wrong and missing words', () => {
    const check = checkPhrase(items, 'Please eat');
    expect(check.letters.map((l) => l.ok)).toEqual([true, false, false]);
    expect(check.letters[2].word).toBeNull();
    expect(check.complete).toBe(false);
  });

  it('counts extra words', () => {
    const check = checkPhrase(items, 'Please do not throw');
    expect(check.extra).toBe(1);
    expect(check.complete).toBe(false);
  });

  it('ignores stray punctuation between words', () => {
    expect(checkPhrase(items, 'Please — do not!').complete).toBe(true);
  });
});

describe('noteLists', () => {
  it('finds lists of 2 to 12 items anywhere in the note', () => {
    const doc: DocNode = {
      type: 'doc',
      content: [
        list('bulletList', 'Only one'),
        { type: 'callout', attrs: { kind: 'mnemonic' }, content: [list('orderedList', 'A', 'B')] },
        list('bulletList', ...Array.from({ length: 13 }, (_, i) => `Item ${i}`)),
      ],
    };
    expect(noteLists(doc)).toEqual([['A', 'B']]);
  });
});

describe('mnemonicCallout', () => {
  it('holds the phrase and each letter with its meaning', () => {
    const box = mnemonicCallout('OSI layers', ['Physical', 'Data link'], ' Please   do ');
    expect(box.attrs).toEqual({ kind: 'mnemonic' });
    expect(docToText({ type: 'doc', content: [box] })).toBe(
      'OSI layers: Please do\nP – Physical\nD – Data link',
    );
    const doc = appendBlock({ type: 'doc', content: [p('Before')] }, box);
    expect(doc.content).toHaveLength(2);
  });
});

describe('mnemonicCards', () => {
  it('makes one card for the phrase and one for its meaning', () => {
    const [phraseCard, meaningCard] = mnemonicCards(
      'OSI layers',
      ['Physical', 'Data link'],
      'Please do',
      {
        asksPhrase: (name) => `Mnemonic for ${name}?`,
        asksMeaning: (phrase) => `${phrase}?`,
      },
    );
    expect(phraseCard.front.text).toBe('Mnemonic for OSI layers?');
    expect(phraseCard.back.text).toBe('Please do');
    expect(meaningCard.front.text).toBe('Please do?');
    expect(meaningCard.back.text).toBe('1. Physical\n2. Data link');
  });
});

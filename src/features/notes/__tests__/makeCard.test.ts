import {
  cardTextFromSelection,
  cleanSelectedText,
  CLOZE_CONTEXT_WHOLE_MAX,
  hasSelectedText,
  isNoteCardType,
  SELECTION_TEXT_MAX,
  sentenceEnd,
  sentenceStart,
} from '../makeCard';

// SAMPLE words only — no drug facts.

describe('cleanSelectedText', () => {
  it('trims, turns non-breaking spaces into spaces and shrinks blank-line runs', () => {
    expect(cleanSelectedText('  one two  \r\n\n\n\nthree \n')).toBe('one two\n\nthree');
  });

  it('knows when there is nothing to make a card from', () => {
    expect(hasSelectedText(null)).toBe(false);
    expect(hasSelectedText({ text: ' \n ', before: null, after: null })).toBe(false);
    expect(hasSelectedText({ text: 'x', before: null, after: null })).toBe(true);
  });

  it('accepts only basic and cloze', () => {
    expect(isNoteCardType('basic')).toBe(true);
    expect(isNoteCardType('cloze')).toBe(true);
    expect(isNoteCardType('type_in')).toBe(false);
    expect(isNoteCardType(undefined)).toBe(false);
  });
});

describe('cardTextFromSelection', () => {
  it('puts the selected text on the front of a basic card', () => {
    expect(
      cardTextFromSelection({ text: ' SAMPLE term ', before: 'A ', after: ' b' }, 'basic'),
    ).toEqual({ text: 'SAMPLE term', tooLong: false });
  });

  it('hides the selection in its paragraph for a cloze card', () => {
    expect(
      cardTextFromSelection(
        { text: 'middle', before: 'The SAMPLE ', after: ' word. Second sentence.' },
        'cloze',
      ),
    ).toEqual({ text: 'The SAMPLE {{c1::middle}} word. Second sentence.', tooLong: false });
  });

  it('keeps spaces selected at either end outside the marker', () => {
    expect(
      cardTextFromSelection({ text: ' middle ', before: 'One', after: 'two' }, 'cloze').text,
    ).toBe('One {{c1::middle}} two');
  });

  it('cuts a long paragraph down to the sentence around the selection', () => {
    const filler = 'Filler words go here and on. '.repeat(15);
    const { text } = cardTextFromSelection(
      { text: 'middle', before: `${filler}This is the `, after: ` sentence. ${filler}` },
      'cloze',
    );
    expect(filler.length * 2).toBeGreaterThan(CLOZE_CONTEXT_WHOLE_MAX);
    expect(text).toBe('This is the {{c1::middle}} sentence.');
  });

  it('leaves the cloze markers to the student when the selection spans paragraphs', () => {
    expect(
      cardTextFromSelection({ text: 'First\nSecond', before: null, after: null }, 'cloze'),
    ).toEqual({ text: 'First\nSecond', tooLong: false });
  });

  it('does not wrap text that would break the markers', () => {
    expect(cardTextFromSelection({ text: 'a}}b', before: 'x ', after: ' y' }, 'cloze').text).toBe(
      'a}}b',
    );
    expect(
      cardTextFromSelection({ text: 'ab', before: '{{c1::x}} ', after: '' }, 'cloze').text,
    ).toBe('ab');
  });

  it('cuts text that is too long for a card field and says so', () => {
    const result = cardTextFromSelection(
      { text: 'a'.repeat(SELECTION_TEXT_MAX + 1), before: null, after: null },
      'basic',
    );
    expect(result.tooLong).toBe(true);
    expect(result.text).toHaveLength(SELECTION_TEXT_MAX);
  });
});

describe('sentence edges', () => {
  it('finds where the sentence starts and ends', () => {
    expect(sentenceStart('One. Two! Three ')).toBe('Three ');
    expect(sentenceEnd(' four. Five.')).toBe(' four.');
    expect(sentenceEnd(' no full stop')).toBe(' no full stop');
  });

  it('cuts a very long sentence at a word, with an ellipsis', () => {
    const words = 'word '.repeat(100);
    expect(sentenceStart(words).startsWith('…')).toBe(true);
    expect(sentenceStart(words).length).toBeLessThanOrEqual(CLOZE_CONTEXT_WHOLE_MAX / 2 + 1);
    expect(sentenceEnd(` ${words}`).endsWith('…')).toBe(true);
  });
});

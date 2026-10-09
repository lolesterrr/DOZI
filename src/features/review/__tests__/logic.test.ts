import {
  allowedSlips,
  answerKey,
  checkTypedAnswer,
  CRAM_AGAIN_GAP,
  cramAfterAnswer,
  diffLetters,
  editDistance,
  minutesSpent,
  parseReviewRoute,
  pinToFront,
  sessionProgress,
  shuffle,
  summariseSession,
  summaryMood,
  type DiffSegment,
} from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.

const joined = (segments: DiffSegment[]) => segments.map((s) => s.text).join('');

describe('answerKey', () => {
  it.each([
    ['Sample Word', 'sampleword'],
    ['  sample-word. ', 'sampleword'],
    ['café', 'cafe'],
    ['β2 sample', 'beta2sample'],
    ['Beta-2 sample', 'beta2sample'],
  ])('%s → %s', (input, key) => {
    expect(answerKey(input)).toBe(key);
  });

  it('turns Greek letters into their names, in either case', () => {
    expect(answerKey('μ-sample')).toBe('musample');
    expect(answerKey('Κ sample')).toBe('kappasample');
  });
});

describe('editDistance and allowedSlips', () => {
  it('counts single-letter changes', () => {
    expect(editDistance('sample', 'sample')).toBe(0);
    expect(editDistance('sample', 'sampel')).toBe(2);
    expect(editDistance('sample', 'smple')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });

  it('allows no slips for very short answers and more for long ones', () => {
    expect(allowedSlips(3)).toBe(0);
    expect(allowedSlips(6)).toBe(1);
    expect(allowedSlips(12)).toBe(2);
    expect(allowedSlips(30)).toBe(3);
  });
});

describe('checkTypedAnswer', () => {
  it('accepts the same answer whatever the case, spacing or punctuation', () => {
    expect(checkTypedAnswer('Sample word', '  sample   WORD ').verdict).toBe('correct');
    expect(checkTypedAnswer('sample-word', 'sample word').verdict).toBe('correct');
    expect(checkTypedAnswer('β-sample', 'beta sample').verdict).toBe('correct');
  });

  it('calls a small typing slip "close"', () => {
    expect(checkTypedAnswer('samplerix', 'samplrix').verdict).toBe('close');
    expect(checkTypedAnswer('samplerix', 'smaplerix').verdict).toBe('close');
  });

  it('marks a different answer, a short answer with a slip, or a blank as wrong', () => {
    expect(checkTypedAnswer('samplerix', 'otherword').verdict).toBe('wrong');
    expect(checkTypedAnswer('abc', 'abd').verdict).toBe('wrong');
    expect(checkTypedAnswer('samplerix', '   ').verdict).toBe('wrong');
  });

  it('keeps both texts, as typed, in the diff', () => {
    const check = checkTypedAnswer('Sample word', 'sampel  word');
    expect(joined(check.typed)).toBe('sampel word');
    expect(joined(check.expected)).toBe('Sample word');
  });
});

describe('diffLetters', () => {
  it('marks extra letters in the typed text and missing ones in the answer', () => {
    expect(diffLetters('smplex', 'sample')).toEqual({
      typed: [
        { text: 'smple', kind: 'same' },
        { text: 'x', kind: 'wrong' },
      ],
      expected: [
        { text: 's', kind: 'same' },
        { text: 'a', kind: 'missed' },
        { text: 'mple', kind: 'same' },
      ],
    });
  });

  it('ignores case when matching letters', () => {
    const diff = diffLetters('SAMPLE', 'sample');
    expect(diff.typed).toEqual([{ text: 'SAMPLE', kind: 'same' }]);
    expect(diff.expected).toEqual([{ text: 'sample', kind: 'same' }]);
  });

  it('copes with empty texts', () => {
    expect(diffLetters('', 'ab')).toEqual({
      typed: [],
      expected: [{ text: 'ab', kind: 'missed' }],
    });
    expect(diffLetters('ab', '')).toEqual({ typed: [{ text: 'ab', kind: 'wrong' }], expected: [] });
  });
});

describe('cram mode', () => {
  it('shuffles without losing or repeating cards', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffle(items, () => 0);
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('puts an "Again" card back a few cards later, and drops any other answer', () => {
    const queue = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(cramAfterAnswer(queue, 1)).toEqual(['b', 'c', 'd', 'a', 'e', 'f']);
    expect(cramAfterAnswer(queue, 1).indexOf('a')).toBe(CRAM_AGAIN_GAP);
    expect(cramAfterAnswer(queue, 3)).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(cramAfterAnswer(['a', 'b'], 1)).toEqual(['b', 'a']);
    expect(cramAfterAnswer(['a'], 1)).toEqual(['a']);
    expect(cramAfterAnswer([], 1)).toEqual([]);
  });

  it('pins a card to the front', () => {
    expect(pinToFront(['a', 'b', 'c'], 'c', (x) => x === 'c')).toEqual(['c', 'a', 'b']);
    expect(pinToFront(['a', 'b'], 'z', (x) => x === 'z')).toEqual(['z', 'a', 'b']);
  });
});

describe('progress and summary', () => {
  it('works out progress from answers and cards left', () => {
    expect(sessionProgress(0, 0)).toBe(0);
    expect(sessionProgress(0, 10)).toBe(0);
    expect(sessionProgress(3, 1)).toBe(0.75);
    expect(sessionProgress(4, 0)).toBe(1);
  });

  it('summarises a session', () => {
    const summary = summariseSession([
      { instanceId: 'a', rating: 1, durationMs: 5000 },
      { instanceId: 'b', rating: 3, durationMs: 3000 },
      { instanceId: 'a', rating: 3, durationMs: 4000 },
      { instanceId: 'c', rating: 4, durationMs: -10 },
    ]);
    expect(summary).toEqual({
      answers: 4,
      cards: 3,
      remembered: 3,
      accuracy: 0.75,
      timeMs: 12000,
    });
    expect(summaryMood(summary)).toBe('proud');
  });

  it('picks a warm reaction for every result', () => {
    const mood = (accuracy: number | null) =>
      summaryMood({ answers: 1, cards: 1, remembered: 0, accuracy, timeMs: 0 });
    expect(mood(null)).toBe('idle');
    expect(mood(1)).toBe('celebrating');
    expect(mood(0.6)).toBe('happy');
    expect(mood(0.2)).toBe('encouraging');
  });

  it('rounds the time to whole minutes, at least one', () => {
    expect(minutesSpent(0)).toBe(0);
    expect(minutesSpent(5000)).toBe(1);
    expect(minutesSpent(150_000)).toBe(3);
  });
});

describe('parseReviewRoute', () => {
  it('reads the scope and mode', () => {
    expect(parseReviewRoute('all', undefined)).toEqual({ scope: 'all', mode: 'review' });
    expect(parseReviewRoute('d1', 'cram')).toEqual({ scope: { deckId: 'd1' }, mode: 'cram' });
    expect(parseReviewRoute(['d2'], ['other'])).toEqual({
      scope: { deckId: 'd2' },
      mode: 'review',
    });
    expect(parseReviewRoute(undefined, undefined).scope).toBe('all');
  });
});

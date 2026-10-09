import {
  cardDraftProblem,
  cardToDraft,
  CLOZE_BLANK,
  clozeNumbers,
  clozePlainText,
  deckSettingsToForm,
  deckTitleProblem,
  docToField,
  draftInstances,
  emptyDraft,
  fieldToDoc,
  instanceFaces,
  instanceKeys,
  lastClozeNumber,
  nextBulkDraft,
  nextClozeNumber,
  parseCloze,
  parseDeckSettingsForm,
  planInstances,
  summariseDraft,
  wrapCloze,
  type CardDraft,
  type CardField,
} from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.
const field = (text: string, mediaIds: string[] = []): CardField => ({ text, mediaIds });
const draft = (type: CardDraft['type'], front: string, back = '', extra = ''): CardDraft => ({
  type,
  front: field(front),
  back: field(back),
  extra: field(extra),
});

describe('deck titles', () => {
  it('needs a name and keeps it short', () => {
    expect(deckTitleProblem('   ')).toBe('empty');
    expect(deckTitleProblem('x'.repeat(81))).toBe('tooLong');
    expect(deckTitleProblem('SAMPLE deck')).toBeNull();
  });
});

describe('deck settings form', () => {
  it('shows the defaults with retention in percent', () => {
    expect(
      deckSettingsToForm({ newPerDay: 15, maxReviewsPerDay: 200, desiredRetention: 0.9 }),
    ).toEqual({ newPerDay: '15', maxReviewsPerDay: '200', retentionPercent: '90' });
  });

  it('turns valid text into settings', () => {
    expect(
      parseDeckSettingsForm({ newPerDay: ' 20 ', maxReviewsPerDay: '0', retentionPercent: '85' }),
    ).toEqual({
      ok: true,
      settings: { newPerDay: 20, maxReviewsPerDay: 0, desiredRetention: 0.85 },
    });
  });

  it('names each bad field', () => {
    expect(
      parseDeckSettingsForm({
        newPerDay: 'ten',
        maxReviewsPerDay: '10000',
        retentionPercent: '50',
      }),
    ).toEqual({
      ok: false,
      errors: {
        newPerDay: 'notNumber',
        maxReviewsPerDay: 'outOfRange',
        retentionPercent: 'outOfRange',
      },
    });
    expect(
      parseDeckSettingsForm({ newPerDay: '', maxReviewsPerDay: '-1', retentionPercent: '99.5' }),
    ).toEqual({
      ok: false,
      errors: {
        newPerDay: 'notNumber',
        maxReviewsPerDay: 'notNumber',
        retentionPercent: 'notNumber',
      },
    });
  });
});

describe('card fields', () => {
  it('saves text as one paragraph per line, then the images', () => {
    expect(fieldToDoc(field('one\n\ntwo  \n', ['m1']))).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
        { type: 'image', attrs: { src: 'media://m1' } },
      ],
    });
  });

  it('reads a saved field back the same', () => {
    const original = field('first line\nsecond {{c1::line}}', ['m1', 'm2']);
    expect(docToField(JSON.stringify(fieldToDoc(original)))).toEqual(original);
    expect(docToField(fieldToDoc(field('')))).toEqual(field(''));
  });

  it('copes with missing or broken JSON', () => {
    expect(docToField(null)).toEqual(field(''));
    expect(docToField('not json')).toEqual(field(''));
    expect(docToField('{"type":"paragraph"}')).toEqual(field(''));
  });
});

describe('cloze', () => {
  it('splits text into plain parts and deletions, with optional hints', () => {
    expect(parseCloze('A {{c1::alpha}} and {{c2::beta::Greek}}.')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'cloze', number: 1, answer: 'alpha', hint: null },
      { type: 'text', text: ' and ' },
      { type: 'cloze', number: 2, answer: 'beta', hint: 'Greek' },
      { type: 'text', text: '.' },
    ]);
  });

  it('treats c0 and unclosed markers as plain text', () => {
    expect(parseCloze('{{c0::x}} {{c1::y')).toEqual([{ type: 'text', text: '{{c0::x}} {{c1::y' }]);
  });

  it('lists numbers once each, in order', () => {
    expect(clozeNumbers('{{c3::a}} {{c1::b}} {{c3::c}}')).toEqual([1, 3]);
    expect(nextClozeNumber('no clozes')).toBe(1);
    expect(nextClozeNumber('{{c1::a}} {{c4::b}}')).toBe(5);
    expect(lastClozeNumber('{{c1::a}} {{c4::b}}')).toBe(4);
    expect(lastClozeNumber('')).toBe(1);
  });

  it('wraps the selection, or inserts an empty cloze at the cursor', () => {
    expect(wrapCloze('The word here', { start: 4, end: 8 }, 1)).toEqual({
      text: 'The {{c1::word}} here',
      selection: { start: 16, end: 16 },
    });
    expect(wrapCloze('ab', { start: 1, end: 1 }, 2)).toEqual({
      text: 'a{{c2::}}b',
      selection: { start: 7, end: 7 },
    });
    // A backwards selection works too.
    expect(wrapCloze('xyz', { start: 3, end: 1 }, 1).text).toBe('x{{c1::yz}}');
  });

  it('gives plain text with the answers kept', () => {
    expect(clozePlainText(' The {{c1::alpha::hint}} and {{c2::beta}} ')).toBe('The alpha and beta');
  });
});

describe('checking a card before saving', () => {
  it('basic and reverse need both sides (text or an image)', () => {
    expect(cardDraftProblem(draft('basic', ' ', 'b'))).toBe('frontEmpty');
    expect(cardDraftProblem(draft('basic_reverse', 'f', ''))).toBe('backEmpty');
    expect(
      cardDraftProblem({ ...draft('basic', ''), front: field('', ['m1']), back: field('b') }),
    ).toBeNull();
  });

  it('cloze needs at least one cloze with an answer', () => {
    expect(cardDraftProblem(draft('cloze', 'no clozes'))).toBe('noCloze');
    expect(cardDraftProblem(draft('cloze', 'a {{c1::}}'))).toBe('emptyCloze');
    expect(cardDraftProblem(draft('cloze', 'a {{c1::b}}'))).toBeNull();
  });

  it('type-in needs a one-line answer', () => {
    expect(cardDraftProblem(draft('type_in', 'q', ' '))).toBe('answerEmpty');
    expect(cardDraftProblem(draft('type_in', 'q', 'a\nb'))).toBe('answerOneLine');
    expect(cardDraftProblem(draft('type_in', 'q', 'a'.repeat(201)))).toBe('answerTooLong');
    expect(cardDraftProblem(draft('type_in', 'q', 'answer'))).toBeNull();
  });

  it('limits text length and images', () => {
    expect(cardDraftProblem(draft('basic', 'x'.repeat(5001), 'b'))).toBe('tooLong');
    expect(
      cardDraftProblem({
        ...draft('basic', 'f', 'b'),
        extra: field('', ['1', '2', '3', '4', '5', '6', '7']),
      }),
    ).toBe('tooManyImages');
  });
});

describe('saving a card', () => {
  it('drops the unused back of a cloze and keeps plain text for previews', () => {
    const saved = summariseDraft(draft('cloze', 'A {{c1::b}}', 'left over', 'note'));
    expect(saved.frontText).toBe('A b');
    expect(saved.backText).toBe('');
    expect(JSON.parse(saved.backJson)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(saved.extraJson).not.toBeNull();
  });

  it('stores no extra when it is empty, and a trimmed type-in answer without images', () => {
    const saved = summariseDraft({
      ...draft('type_in', 'q', '  answer  '),
      back: field('  answer  ', ['m1']),
    });
    expect(saved.extraJson).toBeNull();
    expect(saved.backText).toBe('answer');
    expect(docToField(saved.backJson)).toEqual(field('answer'));
  });

  it('reads a saved card back into the editor', () => {
    const saved = summariseDraft(draft('basic_reverse', 'front', 'back', 'extra'));
    expect(cardToDraft({ type: 'basic_reverse', ...saved })).toEqual(
      draft('basic_reverse', 'front', 'back', 'extra'),
    );
    expect(cardToDraft({ type: 'image_occlusion', ...saved })).toBeNull();
  });

  it('bulk-add starts a fresh card of the same type', () => {
    expect(nextBulkDraft(draft('cloze', 'x {{c1::y}}', '', 'e'))).toEqual(emptyDraft('cloze'));
  });
});

describe('card instances', () => {
  it('gives one key per thing to review', () => {
    expect(instanceKeys('basic', '')).toEqual(['front']);
    expect(instanceKeys('type_in', '')).toEqual(['front']);
    expect(instanceKeys('basic_reverse', '')).toEqual(['front', 'reverse']);
    expect(instanceKeys('cloze', '{{c2::a}} {{c1::b}} {{c2::c}}')).toEqual(['c1', 'c2']);
    expect(instanceKeys('image_occlusion', '')).toEqual([]);
  });

  it('creates missing keys, revives deleted rows and removes rows no longer wanted', () => {
    const plan = planInstances(
      [
        { id: 'a', subKey: 'c1', deletedAt: null },
        { id: 'b', subKey: 'c2', deletedAt: '2026-10-09T00:00:00.000Z' },
        { id: 'c', subKey: 'c3', deletedAt: null },
        { id: 'd', subKey: 'c4', deletedAt: '2026-10-09T00:00:00.000Z' },
      ],
      ['c1', 'c2', 'c5'],
    );
    expect(plan).toEqual({ create: ['c5'], revive: ['b'], remove: ['c'] });
  });

  it('keeps one row per key when sync brought duplicates, preferring a live one', () => {
    const plan = planInstances(
      [
        { id: 'x', subKey: 'c1', deletedAt: '2026-10-09T00:00:00.000Z' },
        { id: 'z', subKey: 'c1', deletedAt: null },
        { id: 'y', subKey: 'c1', deletedAt: null },
      ],
      ['c1', 'c1'],
    );
    expect(plan).toEqual({ create: [], revive: [], remove: ['z'] });
  });
});

describe('showing an instance', () => {
  const text = (face: ReturnType<typeof instanceFaces>['front']) =>
    face.map((block) =>
      block.kind === 'text' ? block.spans.map((s) => s.text).join('') : `[img ${block.mediaId}]`,
    );

  it('hides only the asked cloze; the others show their answers', () => {
    const card = draft('cloze', 'A {{c1::alpha}} and {{c2::beta::hint}}\nsecond line');
    const c1 = instanceFaces(card, 'c1');
    expect(text(c1.front)).toEqual([`A ${CLOZE_BLANK} and beta`, 'second line']);
    expect(c1.front[0]).toEqual({
      kind: 'text',
      spans: [
        { text: 'A ', style: 'plain' },
        { text: CLOZE_BLANK, style: 'hidden' },
        { text: ' and ', style: 'plain' },
        { text: 'beta', style: 'plain' },
      ],
    });
    expect(text(instanceFaces(card, 'c2').front)).toEqual(['A alpha and [hint]', 'second line']);
    const back = instanceFaces(card, 'c1').back;
    expect(back[0].kind === 'text' && back[0].spans[1]).toEqual({ text: 'alpha', style: 'answer' });
  });

  it('swaps the sides of the reverse card and shows images and extra', () => {
    const card: CardDraft = {
      type: 'basic_reverse',
      front: field('term', ['m1']),
      back: field('meaning'),
      extra: field('tip'),
    };
    expect(text(instanceFaces(card, 'front').front)).toEqual(['term', '[img m1]']);
    expect(text(instanceFaces(card, 'reverse').front)).toEqual(['meaning']);
    expect(text(instanceFaces(card, 'reverse').back)).toEqual(['term', '[img m1]']);
    expect(text(instanceFaces(card, 'reverse').extra)).toEqual(['tip']);
  });

  it('previews every instance a draft makes', () => {
    expect(draftInstances(draft('cloze', '{{c1::a}} {{c2::b}}')).map((i) => i.subKey)).toEqual([
      'c1',
      'c2',
    ]);
    expect(draftInstances(draft('basic_reverse', 'f', 'b'))).toHaveLength(2);
    expect(draftInstances(draft('cloze', 'nothing hidden'))).toEqual([]);
  });
});

import { emptyOcclusion } from '@/features/occlusion/logic';

import {
  cardDraftProblem,
  cardToDraft,
  changeDraftType,
  CLOZE_BLANK,
  clozeNumbers,
  clozePlainText,
  deckSettingsToForm,
  deckTitleProblem,
  docToField,
  draftInstanceKeys,
  draftInstances,
  draftMediaIds,
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
  tidyDraft,
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
      block.kind === 'text'
        ? block.spans.map((s) => s.text).join('')
        : block.kind === 'image'
          ? `[img ${block.mediaId}]`
          : `[occlusion ${block.picture.mediaId}]`,
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

describe('image occlusion cards', () => {
  const occlusion = (mode: 'hide_one' | 'hide_all' = 'hide_one') => ({
    mediaId: 'diagram',
    width: 800,
    height: 600,
    mode,
    masks: [
      { id: 'm001', x: 0.1, y: 0.1, w: 0.2, h: 0.1, label: 'SAMPLE one' },
      { id: 'm002', x: 0.5, y: 0.5, w: 0.2, h: 0.1, label: '' },
    ],
    nextMask: 3,
  });
  const ioCard = (mode?: 'hide_one' | 'hide_all'): CardDraft => ({
    ...draft('image_occlusion', 'SAMPLE prompt', 'ignored back', 'SAMPLE tip'),
    occlusion: occlusion(mode),
  });

  it('switching to occlusion starts an empty one; switching away drops it when saved', () => {
    const switched = changeDraftType(draft('basic', 'kept'), 'image_occlusion');
    expect(switched.occlusion).toEqual(emptyOcclusion());
    expect(switched.front.text).toBe('kept');
    expect(cardDraftProblem(switched)).toBe('noImage');
    expect(tidyDraft({ ...ioCard(), type: 'basic' })).not.toHaveProperty('occlusion');
    expect(summariseDraft({ ...ioCard(), type: 'basic' }).occlusionJson).toBeNull();
  });

  it('makes one instance per box, in box order', () => {
    expect(draftInstanceKeys(ioCard())).toEqual(['m001', 'm002']);
    expect(instanceKeys('image_occlusion', '')).toEqual([]);
  });

  it('saves the prompt, the diagram (for image lists) and the boxes, and reads them back', () => {
    const saved = summariseDraft(ioCard());
    expect(saved.frontText).toBe('SAMPLE prompt');
    expect(saved.backText).toBe('SAMPLE one');
    expect(docToField(saved.frontJson)).toEqual(field('SAMPLE prompt', ['diagram']));
    expect(docToField(saved.backJson)).toEqual(field(''));
    const back = cardToDraft({ type: 'image_occlusion', ...saved });
    expect(back).toEqual({ ...ioCard(), back: field('') });
    expect(draftMediaIds(ioCard())).toEqual(['diagram']);
    // Unreadable boxes: the card can't be opened in the editor.
    expect(cardToDraft({ type: 'image_occlusion', ...saved, occlusionJson: '{}' })).toBeNull();
  });

  it('with no prompt, the labels stand in for the card’s text', () => {
    expect(summariseDraft({ ...ioCard(), front: field('') }).frontText).toBe('SAMPLE one');
  });

  it('shows the prompt and the diagram; the answer side uncovers the box and adds its label', () => {
    const faces = instanceFaces(ioCard(), 'm001');
    expect(faces.front.map((b) => b.kind)).toEqual(['text', 'occlusion']);
    const question = faces.front[1];
    const answer = faces.back[1];
    if (question.kind !== 'occlusion' || answer.kind !== 'occlusion') throw new Error('no picture');
    expect(question.picture.boxes.map((b) => b.look)).toEqual(['asked']);
    expect(answer.picture.boxes.map((b) => b.look)).toEqual(['revealed']);
    expect(faces.back[2]).toEqual({
      kind: 'text',
      spans: [{ text: 'SAMPLE one', style: 'answer' }],
    });
    expect(faces.extra).toHaveLength(1);
    // A box with no label adds no line.
    expect(instanceFaces(ioCard(), 'm002').back).toHaveLength(2);
    const hideAll = instanceFaces(ioCard('hide_all'), 'm002');
    if (hideAll.front[1]?.kind !== 'occlusion') throw new Error('no picture');
    expect(hideAll.front[1].picture.boxes.map((b) => b.look)).toEqual(['covered', 'asked']);
  });

  it('bulk add keeps the type and the hiding mode, and starts a fresh diagram', () => {
    const next = nextBulkDraft(ioCard('hide_all'));
    expect(next.type).toBe('image_occlusion');
    expect(next.occlusion).toEqual({ ...emptyOcclusion(), mode: 'hide_all' });
  });
});

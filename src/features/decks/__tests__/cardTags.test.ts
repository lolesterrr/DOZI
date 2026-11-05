import {
  addCardTags,
  CARD_TAGS_MAX,
  cardHasTag,
  cardTagProblem,
  cardTagsJson,
  cleanCardTags,
  deckTags,
  draftMatchKey,
  filterCardsByTag,
  liveTagFilter,
  parseCardTags,
  planCardImport,
  removeCardTag,
  sameCardTag,
  tagUse,
  type CardDraft,
} from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.

const draft = (type: CardDraft['type'], front: string, back = ''): CardDraft => ({
  type,
  front: { text: front, mediaIds: [] },
  back: { text: back, mediaIds: [] },
  extra: { text: '', mediaIds: [] },
});

const card = (tags: string[]) => ({ tagsJson: cardTagsJson(tags) });

describe('card tag names', () => {
  it('tidies spaces, drops empty, over-long and repeated names, keeps the first spelling', () => {
    expect(cleanCardTags(['  Year   2 ', '', 'year 2', 'x'.repeat(31), 'Sample'])).toEqual([
      'Year 2',
      'Sample',
    ]);
  });

  it('keeps at most CARD_TAGS_MAX', () => {
    const names = Array.from({ length: CARD_TAGS_MAX + 3 }, (_, i) => `t${i}`);
    expect(cleanCardTags(names)).toHaveLength(CARD_TAGS_MAX);
  });

  it('compares names ignoring case and spaces', () => {
    expect(sameCardTag('Year  2', 'year 2')).toBe(true);
    expect(sameCardTag('Year 2', 'Year 3')).toBe(false);
  });

  it('says what is wrong with a name', () => {
    expect(cardTagProblem('  ')).toBe('empty');
    expect(cardTagProblem('x'.repeat(31))).toBe('tooLong');
    expect(cardTagProblem('Sample')).toBeNull();
  });

  it('reads tags_json safely', () => {
    expect(parseCardTags('["Sample","Year 2"]')).toEqual(['Sample', 'Year 2']);
    expect(parseCardTags('[]')).toEqual([]);
    expect(parseCardTags(null)).toEqual([]);
    expect(parseCardTags('not json')).toEqual([]);
    expect(parseCardTags('{"a":1}')).toEqual([]);
    expect(parseCardTags('["ok", 3, null]')).toEqual(['ok']);
  });

  it('adds and removes tags without repeats', () => {
    expect(addCardTags(['Sample'], ['sample', 'Year 2'])).toEqual(['Sample', 'Year 2']);
    expect(removeCardTag(['Sample', 'Year 2'], 'year 2')).toEqual(['Sample']);
    expect(cardHasTag(cardTagsJson(['Sample']), 'SAMPLE')).toBe(true);
  });
});

describe('tags in a deck', () => {
  const cards = [card(['Year 2', 'Sample']), card(['year 2']), card([])];

  it('lists each tag once, A–Z, with how many cards have it', () => {
    expect(deckTags(cards)).toEqual([
      { name: 'Sample', count: 1 },
      { name: 'Year 2', count: 2 },
    ]);
  });

  it('filters cards by a tag, or shows every card', () => {
    expect(filterCardsByTag(cards, 'YEAR 2')).toHaveLength(2);
    expect(filterCardsByTag(cards, null)).toHaveLength(3);
  });

  it('says whether all, some or none of the cards have a tag', () => {
    expect(tagUse(cards.slice(0, 2), 'Year 2')).toBe('all');
    expect(tagUse(cards, 'Year 2')).toBe('some');
    expect(tagUse(cards, 'Other')).toBe('none');
  });

  it('drops a filter whose tag no card has any more', () => {
    const tags = deckTags(cards);
    expect(liveTagFilter('year 2', tags)).toBe('Year 2');
    expect(liveTagFilter('Gone', tags)).toBeNull();
    expect(liveTagFilter(null, tags)).toBeNull();
  });
});

describe('planCardImport', () => {
  it('adds new cards with their own tags', () => {
    const plan = planCardImport(
      [draft('basic', 'SAMPLE zib', 'zob'), draft('basic', 'SAMPLE wib', 'wob')],
      [['Year 2'], []],
      [],
    );
    expect(plan).toEqual({
      steps: [
        { kind: 'create', draftIndex: 0, tags: ['Year 2'] },
        { kind: 'create', draftIndex: 1, tags: [] },
      ],
      added: 2,
      existing: 0,
      repeated: 0,
    });
  });

  it('only tags a row that is already in the deck', () => {
    const zib = draft('basic', 'SAMPLE zib', 'zob');
    const plan = planCardImport([zib], [['Sample']], [{ id: 'c1', key: draftMatchKey(zib) }]);
    expect(plan.steps).toEqual([{ kind: 'tag', cardId: 'c1', tags: ['Sample'] }]);
    expect(plan).toMatchObject({ added: 0, existing: 1, repeated: 0 });
  });

  it('folds a repeated row into the first, merging tags', () => {
    const plan = planCardImport(
      [draft('basic', 'SAMPLE zib', 'zob'), draft('basic', 'SAMPLE zib', 'zob')],
      [['A'], ['B']],
      [],
    );
    expect(plan.steps).toEqual([{ kind: 'create', draftIndex: 0, tags: ['A', 'B'] }]);
    expect(plan).toMatchObject({ added: 1, repeated: 1 });
  });

  it('treats a different type or back as a different card, and skips unusable drafts', () => {
    const plan = planCardImport(
      [
        draft('basic', 'SAMPLE zib', 'zob'),
        draft('basic_reverse', 'SAMPLE zib', 'zob'),
        draft('basic', 'SAMPLE zib', 'other'),
        draft('basic', 'no back'),
      ],
      [],
      [],
    );
    expect(plan.added).toBe(3);
  });
});

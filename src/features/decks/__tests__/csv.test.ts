import {
  CSV_HEADER,
  deckToCsv,
  detectSeparator,
  htmlToText,
  IMPORT_ROWS_MAX,
  IMPORT_TAGS_MAX,
  joinTags,
  parseCsv,
  planCsvImport,
  readDirectives,
  splitTags,
  toCsv,
} from '../csv';
import { cardToDraft, summariseDraft, type CardDraft } from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.

const draft = (type: CardDraft['type'], front: string, back = '', extra = ''): CardDraft => ({
  type,
  front: { text: front, mediaIds: [] },
  back: { text: back, mediaIds: [] },
  extra: { text: extra, mediaIds: [] },
});

/** A draft as it would be saved in the `cards` table. */
const saved = (d: CardDraft) => {
  const s = summariseDraft(d);
  return { type: d.type, frontJson: s.frontJson, backJson: s.backJson, extraJson: s.extraJson };
};

function plan(text: string) {
  const result = planCsvImport(text);
  if (!result.ok) throw new Error(`Expected a plan, got ${result.error}`);
  return result.plan;
}

describe('parseCsv', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b,c\r\nd,e,f\n')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('reads quoted cells with separators, quotes and line breaks', () => {
    expect(parseCsv('"one, two","say ""zib""","line 1\r\nline 2"\n')).toEqual([
      ['one, two', 'say "zib"', 'line 1\nline 2'],
    ]);
  });

  it('keeps empty cells and drops blank lines', () => {
    expect(parseCsv('a,,c\n\n,b,\n')).toEqual([
      ['a', '', 'c'],
      ['', 'b', ''],
    ]);
  });

  it('reads a last row with no line end', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('uses the separator it is given', () => {
    expect(parseCsv('a;b,c\n', ';')).toEqual([['a', 'b,c']]);
  });
});

describe('detectSeparator', () => {
  it.each([
    ['a,b,c', ','],
    ['a;b;c', ';'],
    ['a\tb\tc', '\t'],
    ['"x;y",b,c', ','],
    ['just one cell', ','],
  ])('%j → %j', (text, separator) => {
    expect(detectSeparator(text)).toBe(separator);
  });
});

describe('toCsv', () => {
  it('quotes only cells that need it and ends lines with CRLF', () => {
    expect(
      toCsv([
        ['plain', 'has, comma', 'has "quote"'],
        ['two\nlines', '', 'x'],
      ]),
    ).toBe('plain,"has, comma","has ""quote"""\r\n"two\nlines",,x\r\n');
  });

  it('reads back what it writes', () => {
    const rows = [
      ['zib, zob', 'say "hi"', 'µg · α β'],
      ['line 1\nline 2', '', '=not a formula'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('Anki extras', () => {
  it('reads #separator, #html and #tags column lines', () => {
    const { body, options } = readDirectives(
      '#separator:tab\n#html:true\n#tags column:3\nfront\tback\ttags',
    );
    expect(body).toBe('front\tback\ttags');
    expect(options).toEqual({ separator: '\t', html: true, tagsColumn: 2 });
  });

  it('turns simple HTML into text', () => {
    expect(htmlToText('<b>Zib</b> blocks<br>zob<div>third</div>')).toBe('Zib blocks\nzob\nthird');
    expect(htmlToText('a&nbsp;b &amp; c &#945;', true)).toBe('a b & c α');
  });

  it('leaves text that only looks a bit like HTML alone', () => {
    expect(htmlToText('K < 3 and > 1 &amp;')).toBe('K < 3 and > 1 &amp;');
  });

  it('imports an Anki plain-text export', () => {
    const p = plan(
      '#separator:tab\n#html:true\n#tags column:3\nWhat is <i>zib</i>?\tA <b>zob</b>\tsample week1\n',
    );
    expect(p.drafts).toEqual([draft('basic', 'What is zib?', 'A zob')]);
    expect(p.tags).toEqual(['sample', 'week1']);
  });
});

describe('tags', () => {
  it('splits on commas when there are any, otherwise on spaces', () => {
    expect(splitTags('Year 2, Term one')).toEqual(['Year 2', 'Term one']);
    expect(splitTags('alpha beta')).toEqual(['alpha', 'beta']);
    expect(splitTags('Year 2,')).toEqual(['Year 2']);
    expect(splitTags('  ')).toEqual([]);
  });

  it('joins so that splitting gives the same tags back', () => {
    for (const names of [[], ['solo'], ['Year 2'], ['Year 2', 'Term one'], ['a', 'b']]) {
      expect(splitTags(joinTags(names))).toEqual(names);
    }
  });
});

describe('planCsvImport', () => {
  it('reads front, back, tags without a header', () => {
    const p = plan('Zib?,Zob,sample\nWib?,Wob,\n');
    expect(p.drafts).toEqual([draft('basic', 'Zib?', 'Zob'), draft('basic', 'Wib?', 'Wob')]);
    expect(p.tags).toEqual(['sample']);
    expect(p.skipped).toEqual([]);
  });

  it('maps columns by a header row in any order, ignoring case', () => {
    const p = plan('Type,Extra,Back,Front\nbasic_reverse,a hint,Zob,Zib\n');
    expect(p.drafts).toEqual([draft('basic_reverse', 'Zib', 'Zob', 'a hint')]);
  });

  it('accepts question/answer headers', () => {
    expect(plan('question,answer\nZib?,Zob\n').drafts).toEqual([draft('basic', 'Zib?', 'Zob')]);
  });

  it('strips a byte-order mark and reads semicolons', () => {
    expect(plan('﻿front;back\nZib;Zob\n').drafts).toEqual([draft('basic', 'Zib', 'Zob')]);
  });

  it('treats a front with {{c1::…}} as a cloze card, and its back as the extra', () => {
    const p = plan('The {{c1::zib}} is {{c2::zob}},a note\n');
    expect(p.drafts).toEqual([draft('cloze', 'The {{c1::zib}} is {{c2::zob}}', '', 'a note')]);
  });

  it('understands type names in words', () => {
    const p = plan('front,back,type\nA,B,Basic + reverse\nC,D,type-in\nE,F,\n');
    expect(p.drafts.map((d) => d.type)).toEqual(['basic_reverse', 'type_in', 'basic']);
  });

  it('skips rows that cannot be cards and says why, by row number', () => {
    const p = plan(
      [
        'front,back,type',
        'Zib,,basic', // row 2: no back
        ',,', // row 3: blank, ignored
        'Ok,Fine,basic',
        'No markers here,,cloze', // row 5
        'Q,"two\nlines",type_in', // row 6
        'Pic,,image_occlusion', // row 7
      ].join('\n'),
    );
    expect(p.drafts).toEqual([draft('basic', 'Ok', 'Fine')]);
    expect(p.skipped).toEqual([
      { row: 2, reason: 'backEmpty' },
      { row: 5, reason: 'noCloze' },
      { row: 6, reason: 'answerOneLine' },
      { row: 7, reason: 'imageOcclusion' },
    ]);
  });

  it('skips a field over the length limit', () => {
    const p = plan(`front,back\nok,fine\n${'z'.repeat(5001)},b\n`);
    expect(p.skipped).toEqual([{ row: 3, reason: 'tooLong' }]);
  });

  it('keeps at most IMPORT_TAGS_MAX tags, without repeats', () => {
    const tags = Array.from({ length: IMPORT_TAGS_MAX + 5 }, (_, i) => `t${i}`).join(' ');
    const p = plan(`a,b,Sample\nc,d,sample ${tags}\n`);
    expect(p.tags).toHaveLength(IMPORT_TAGS_MAX);
    expect(p.tags[0]).toBe('Sample');
  });

  it('reads at most IMPORT_ROWS_MAX rows', () => {
    const rows = Array.from({ length: IMPORT_ROWS_MAX + 2 }, (_, i) => `q${i},a${i}`).join('\n');
    const p = plan(rows);
    expect(p.drafts).toHaveLength(IMPORT_ROWS_MAX);
    expect(p.truncated).toBe(true);
  });

  it('says when a file is empty or has no usable rows', () => {
    expect(planCsvImport('')).toEqual({ ok: false, error: 'empty' });
    expect(planCsvImport('front,back\n')).toEqual({ ok: false, error: 'empty' });
    expect(planCsvImport('front,back\nonly front,\n')).toEqual({ ok: false, error: 'noCards' });
  });
});

describe('deckToCsv', () => {
  it('writes a header, a row per card and the deck tags on every row', () => {
    const result = deckToCsv(
      [saved(draft('basic', 'Zib', 'Zob')), saved(draft('cloze', 'A {{c1::wib}}', '', 'x'))],
      ['Year 2'],
    );
    expect(result.csv.startsWith('﻿')).toBe(true);
    expect(parseCsv(result.csv.slice(1))).toEqual([
      [...CSV_HEADER],
      ['Zib', 'Zob', 'Year 2,', '', 'basic'],
      ['A {{c1::wib}}', '', 'Year 2,', 'x', 'cloze'],
    ]);
    expect(result).toMatchObject({ exported: 2, leftOut: 0, withoutImages: 0 });
  });

  it('leaves out image occlusion cards and counts cards that lose images', () => {
    const withImage = draft('basic', 'Zib', 'Zob');
    withImage.front.mediaIds = ['m1'];
    const result = deckToCsv(
      [
        saved(withImage),
        { type: 'image_occlusion', frontJson: '{}', backJson: '{}', extraJson: null },
      ],
      [],
    );
    expect(result).toMatchObject({ exported: 1, leftOut: 1, withoutImages: 1 });
  });

  it('round-trips every text card type, with line breaks, commas and quotes', () => {
    const cards = [
      draft('basic', 'Zib, the "first"', 'Zob\nsecond line', 'a mnemonic'),
      draft('basic_reverse', 'Wib', 'Wob'),
      draft('cloze', 'The {{c1::zib::hint}} and {{c2::zob}}', '', 'extra; with semicolon'),
      draft('type_in', 'Type the zib', 'zob'),
      draft('basic', 'µg · α-zib', 'β-zob'),
    ];
    const { csv } = deckToCsv(cards.map(saved), ['Sample', 'Year 2']);
    const p = plan(csv);
    expect(p.skipped).toEqual([]);
    expect(p.tags).toEqual(['Sample', 'Year 2']);
    // What gets saved again is identical to the original cards.
    expect(p.drafts.map((d) => cardToDraft(saved(d)))).toEqual(
      cards.map((d) => cardToDraft(saved(d))),
    );
  });
});

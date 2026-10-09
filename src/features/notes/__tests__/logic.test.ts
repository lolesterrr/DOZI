import {
  cleanTitle,
  countWords,
  docToText,
  emptyDoc,
  formatVersionTime,
  isDocEmpty,
  mediaIdsInDoc,
  notePreview,
  NOTE_TITLE_MAX,
  NOTE_VERSION_INTERVAL_MS,
  parseNoteContent,
  shouldKeepVersion,
  summariseContent,
  toNoteDoc,
  versionsToPrune,
  type DocNode,
} from '../logic';

// SAMPLE content for tests only — not reviewed pharmacology.
const text = (value: string, marks?: DocNode['marks']): DocNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const cell = (type: 'tableHeader' | 'tableCell', value: string): DocNode => ({
  type,
  content: [p(text(value))],
});

const sampleDoc: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('SAMPLE heading')] },
    p(text('Bold', [{ type: 'bold' }]), text(' and '), text('marked', [{ type: 'highlight' }])),
    { type: 'image', attrs: { src: 'media://img-1' } },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [p(text('first point'))] }],
    },
    {
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(text('done'))] }],
    },
    { type: 'horizontalRule' },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('tableHeader', 'Col A'), cell('tableHeader', 'Col B')] },
        { type: 'tableRow', content: [cell('tableCell', 'a1'), cell('tableCell', 'b1')] },
      ],
    },
    p(text('line one'), { type: 'hardBreak' }, text('line two')),
    { type: 'image', attrs: { src: 'media://img-2' } },
    { type: 'image', attrs: { src: 'media://img-1' } },
  ],
};

describe('note content', () => {
  it('turns a document into plain text, one line per block', () => {
    expect(docToText(sampleDoc)).toBe(
      [
        'SAMPLE heading',
        'Bold and marked',
        'first point',
        'done',
        'Col A',
        'Col B',
        'a1',
        'b1',
        'line one',
        'line two',
      ].join('\n'),
    );
  });

  it('counts words with letters or digits, across languages', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  one two\nthree  ')).toBe(3);
    expect(countWords('β-blockers — 2 mg · ok')).toBe(4);
  });

  it('summarises content for saving', () => {
    const summary = summariseContent(sampleDoc);
    expect(JSON.parse(summary.contentJson)).toEqual(sampleDoc);
    expect(summary.wordCount).toBe(18);
  });

  it('lists media ids once each, in order', () => {
    expect(mediaIdsInDoc(sampleDoc)).toEqual(['img-1', 'img-2']);
  });

  it('knows when a note is empty', () => {
    expect(isDocEmpty(emptyDoc())).toBe(true);
    expect(isDocEmpty({ type: 'doc', content: [p(text('   '))] })).toBe(true);
    expect(isDocEmpty({ type: 'doc', content: [{ type: 'horizontalRule' }] })).toBe(false);
    expect(isDocEmpty({ type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] })).toBe(
      false,
    );
    expect(isDocEmpty(sampleDoc)).toBe(false);
  });

  it('parses saved JSON and rejects anything that is not a note body', () => {
    expect(parseNoteContent(JSON.stringify(sampleDoc))).toEqual(sampleDoc);
    expect(() => parseNoteContent('{"type":"paragraph"}')).toThrow();
    expect(() => parseNoteContent('not json')).toThrow();
    expect(toNoteDoc({ type: 'doc', content: [{ nope: 1 }] })).toBeNull();
    expect(toNoteDoc(null)).toBeNull();
    // Unknown attributes are kept, so nothing the editor saves is lost.
    expect(toNoteDoc({ type: 'doc', extra: 1, content: [] })).toEqual({
      type: 'doc',
      extra: 1,
      content: [],
    });
  });
});

describe('titles and previews', () => {
  it('cleans titles', () => {
    expect(cleanTitle('  Beta \n blockers  ')).toBe('Beta blockers');
    expect(cleanTitle('x'.repeat(200))).toHaveLength(NOTE_TITLE_MAX);
  });

  it('previews the first non-empty line, shortened', () => {
    expect(notePreview('\nFirst line\nSecond')).toBe('First line');
    expect(notePreview('a'.repeat(100), 10)).toBe('aaaaaaaaa…');
    expect(notePreview('')).toBe('');
  });
});

describe('versions', () => {
  const now = Date.parse('2026-10-09T12:00:00.000Z');
  const base = { previousJson: 'old', nextJson: 'new', previousIsEmpty: false, nowMs: now };

  it('keeps the old content when there is no version yet', () => {
    expect(shouldKeepVersion({ ...base, newestVersion: undefined })).toBe(true);
  });

  it('does not keep unchanged or blank content', () => {
    expect(shouldKeepVersion({ ...base, nextJson: 'old', newestVersion: undefined })).toBe(false);
    expect(shouldKeepVersion({ ...base, previousIsEmpty: true, newestVersion: undefined })).toBe(
      false,
    );
  });

  it('waits for the interval between versions', () => {
    const at = (msAgo: number) => new Date(now - msAgo).toISOString();
    const recent = { createdAt: at(NOTE_VERSION_INTERVAL_MS - 1), contentJson: 'older' };
    const old = { createdAt: at(NOTE_VERSION_INTERVAL_MS), contentJson: 'older' };
    expect(shouldKeepVersion({ ...base, newestVersion: recent })).toBe(false);
    expect(shouldKeepVersion({ ...base, newestVersion: old })).toBe(true);
    // Already saved as the newest version: no duplicate.
    expect(shouldKeepVersion({ ...base, newestVersion: { ...old, contentJson: 'old' } })).toBe(
      false,
    );
  });

  it('prunes everything after the newest ten', () => {
    const versions = Array.from({ length: 13 }, (_, i) => ({
      id: `v${i}`,
      createdAt: `2026-10-09T10:${String(i).padStart(2, '0')}:00.000Z`,
    }));
    expect(versionsToPrune(versions).sort()).toEqual(['v0', 'v1', 'v2']);
    expect(versionsToPrune(versions.slice(0, 5))).toEqual([]);
  });

  it('formats version times in the student’s timezone', () => {
    expect(formatVersionTime('2026-10-09T11:05:00.000Z')).toBe('9 Oct, 14:05');
    expect(formatVersionTime('2026-10-09T11:05:00.000Z', 'UTC')).toBe('9 Oct, 11:05');
  });
});

import type { CardField } from '@/features/decks/logic';
import type { DocNode } from '@/features/notes/logic';
import type { QuestionDraft } from '@/features/quizzes/logic';
import { strings } from '@/i18n/strings';

import {
  escapeHtml,
  exportFileName,
  formatExportDate,
  noteToHtml,
  quizMediaIds,
  quizToHtml,
  type PrintableQuestion,
} from '../logic';

// SAMPLE content for tests only — made-up words, no drug facts.

const exportedAt = '2026-10-26T21:30:00.000Z'; // 27 Oct in Kampala (UTC+3)
const field = (text: string, mediaIds: string[] = []): CardField => ({ text, mediaIds });
const text = (value: string, marks?: DocNode['marks']): DocNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });

describe('helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  it('makes safe file names', () => {
    expect(exportFileName('Week 3: zib/zob?', 'pdf')).toBe('Week 3 zib zob.pdf');
    expect(exportFileName('   ', 'csv')).toBe('Dozi.csv');
    expect(exportFileName('z'.repeat(100), 'csv')).toBe(`${'z'.repeat(60)}.csv`);
  });

  it('dates the export in Kampala time', () => {
    expect(formatExportDate(exportedAt)).toBe('27 Oct 2026');
  });
});

describe('noteToHtml', () => {
  const doc: DocNode = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [text('SAMPLE heading')] },
      p(
        text('bold', [{ type: 'bold' }]),
        text(' and '),
        text('marked', [{ type: 'highlight', attrs: { color: 'danger' } }]),
        text(' <tag>'),
      ),
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [p(text('item one'))] }],
      },
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: true }, content: [p(text('done'))] },
          { type: 'taskItem', attrs: { checked: false }, content: [p(text('to do'))] },
        ],
      },
      { type: 'callout', attrs: { kind: 'mnemonic' }, content: [p(text('SAMPLE ZIB'))] },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [p(text('Head'))] },
              { type: 'tableCell', attrs: { colspan: 2 }, content: [p(text('Cell'))] },
            ],
          },
        ],
      },
      { type: 'image', attrs: { src: 'media://m1' } },
      { type: 'image', attrs: { src: 'media://gone' } },
      { type: 'horizontalRule' },
      p(text('link', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])),
      { type: 'somethingNew', content: [p(text('kept text'))] },
    ],
  };
  const html = noteToHtml({
    title: 'SAMPLE <note>',
    doc,
    images: new Map([
      ['m1', 'data:image/jpeg;base64,AAAA'],
      ['gone', null],
    ]),
    exportedAt,
  });

  it('has the title, date and study disclaimer', () => {
    expect(html).toContain('<h1>SAMPLE &lt;note&gt;</h1>');
    expect(html).toContain(strings.transfer.pdf.exportedOn('27 Oct 2026'));
    expect(html).toContain(escapeHtml(strings.disclaimer));
  });

  it('draws headings one level below the title, with marks escaped', () => {
    expect(html).toContain('<h2>SAMPLE heading</h2>');
    expect(html).toContain('<strong>bold</strong> and <mark data-color="danger">marked</mark>');
    expect(html).toContain(' &lt;tag&gt;');
    expect(html).not.toContain('<tag>');
  });

  it('draws lists, checklists, tables, dividers and callouts with their label', () => {
    expect(html).toContain('<ul><li><p>item one</p></li></ul>');
    expect(html).toContain('☑');
    expect(html).toContain('☐');
    expect(html).toContain('<th><p>Head</p></th><td colspan="2"><p>Cell</p></td>');
    expect(html).toContain('<hr />');
    expect(html).toContain(
      `<div class="callout" data-callout="mnemonic"><div class="callout-label">${strings.notes.callouts.mnemonic}</div>`,
    );
  });

  it('embeds images it has and says when one is missing', () => {
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA" alt="" />');
    expect(html).toContain(escapeHtml(strings.transfer.pdf.imageMissing));
  });

  it('drops unsafe links but keeps their text, and keeps text of unknown nodes', () => {
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<p>link</p>');
    expect(html).toContain('kept text');
  });
});

describe('quizToHtml', () => {
  const base = { stem: field(''), explanation: field(''), difficulty: 2 as const };
  const questions: PrintableQuestion[] = [
    {
      points: 1,
      draft: {
        ...base,
        stem: field('SAMPLE pick one', ['img1']),
        explanation: field('Because zib.', ['img2']),
        type: 'sba',
        payload: {
          options: [
            { id: 'o1', text: 'Zib', correct: false, why: '' },
            { id: 'o2', text: 'Zob', correct: true, why: 'it is zob' },
          ],
        },
      },
    },
    {
      points: 2,
      draft: {
        ...base,
        stem: field('SAMPLE pick all'),
        type: 'multiple_response',
        payload: {
          options: [
            { id: 'o1', text: 'Wib', correct: true, why: '' },
            { id: 'o2', text: 'Wob', correct: true, why: '' },
          ],
        },
      },
    },
    {
      points: 5,
      draft: {
        ...base,
        stem: field('SAMPLE true or false'),
        type: 'mtf',
        payload: {
          statements: [
            { id: 's1', text: 'Zib is zob', answer: true, why: '' },
            { id: 's2', text: 'Wib is wob', answer: false, why: 'never' },
          ],
        },
      },
    },
    {
      points: 2,
      draft: {
        ...base,
        type: 'fill_blank',
        payload: {
          text: 'A {{1}} and a {{2}}.',
          blanks: [
            { id: '1', answers: ['zib', 'zibs'] },
            { id: '2', answers: ['zob'] },
          ],
        },
      },
    },
    {
      points: 2,
      draft: {
        ...base,
        stem: field('SAMPLE match'),
        type: 'matching',
        payload: {
          pairs: [
            { id: 'p1', left: 'Zib', right: 'Zulu' },
            { id: 'p2', left: 'Wib', right: 'Alpha' },
          ],
        },
      },
    },
    {
      points: 4,
      draft: {
        ...base,
        stem: field('SAMPLE explain zib'),
        type: 'saq',
        payload: { marking_points: [{ id: 'm1', text: 'mentions zob' }], model_answer: 'Zib.' },
      },
    },
    { points: 1, draft: null },
  ] satisfies { points: number; draft: QuestionDraft | null }[];

  const paper = (withAnswers: boolean) =>
    quizToHtml({
      title: 'SAMPLE quiz',
      description: 'For <practice>',
      questions,
      withAnswers,
      images: new Map([['img1', 'data:image/jpeg;base64,BBBB']]),
      exportedAt,
    });

  it('numbers each question and shows its points', () => {
    const html = paper(false);
    expect(html).toContain('Question 1 <span class="pts">(1 point)</span>');
    expect(html).toContain('Question 3 <span class="pts">(5 points)</span>');
    expect(html).toContain('For &lt;practice&gt;');
    expect(html).toContain('data:image/jpeg;base64,BBBB');
  });

  it('gives no answers away in the question paper', () => {
    const html = paper(false);
    expect(html).not.toContain(strings.transfer.pdf.answers);
    expect(html).not.toContain('it is zob');
    expect(html).not.toContain('mentions zob');
    expect(html).not.toContain('zibs');
    expect(html).toContain('<span class="blank">');
    // Matching: the right-hand side is in A–Z order, not answer order.
    expect(html.indexOf('A. Alpha')).toBeLessThan(html.indexOf('B. Zulu'));
    expect(html).toContain(strings.transfer.pdf.chooseAll);
    expect(html).toContain(strings.transfer.pdf.unreadable);
  });

  it('adds an answer key on a new page when asked', () => {
    const html = paper(true);
    expect(html).toContain('<div class="answers"><h2>Answers</h2>');
    expect(html).toContain('✓ Correct:</span> Zob <span class="why">— it is zob</span>');
    expect(html).toContain('<span class="right">False</span> — Wib is wob');
    expect(html).toContain('Blank 1: zib / zibs');
    expect(html).toContain('1. Zib → B. Zulu');
    expect(html).toContain('2. Wib → A. Alpha');
    expect(html).toContain('<li>mentions zob</li>');
    expect(html).toContain('Because zib.');
    // The explanation's image isn't loaded, so it says so.
    expect(html).toContain(escapeHtml(strings.transfer.pdf.imageMissing));
  });

  it('lists the images a paper needs', () => {
    expect(quizMediaIds(questions, false)).toEqual(['img1']);
    expect(quizMediaIds(questions, true)).toEqual(['img1', 'img2']);
  });
});

import { strings } from '@/i18n/strings';

import { docToText, mediaIdsInDoc, type CalloutKind, type DocNode } from './logic';

// Note templates (PRODUCT_SPEC §4.1): headings, an empty table or a callout to fill in. They
// hold structure only, never drug facts. A note remembers its template in `notes.template`.

export const noteTemplates = ['lecture', 'drugProfile', 'classComparison', 'caseSummary'] as const;
export type NoteTemplate = (typeof noteTemplates)[number];

export function isNoteTemplate(value: unknown): value is NoteTemplate {
  return typeof value === 'string' && (noteTemplates as readonly string[]).includes(value);
}

const t = strings.notes.templates;

const text = (value: string): DocNode => ({ type: 'text', text: value });
const paragraph = (value?: string): DocNode =>
  value ? { type: 'paragraph', content: [text(value)] } : { type: 'paragraph' };
const heading = (value: string): DocNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [text(value)],
});
/** A heading followed by an empty line to write in. */
const section = (value: string): DocNode[] => [heading(value), paragraph()];
const callout = (kind: CalloutKind): DocNode => ({
  type: 'callout',
  attrs: { kind },
  content: [paragraph()],
});

function table(headers: readonly string[], bodyRows: number): DocNode {
  const cell = (type: 'tableHeader' | 'tableCell', value?: string): DocNode => ({
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
    content: [paragraph(value)],
  });
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: headers.map((h) => cell('tableHeader', h)) },
      ...Array.from({ length: bodyRows }, () => ({
        type: 'tableRow',
        content: headers.map(() => cell('tableCell')),
      })),
    ],
  };
}

/** A new note body for a template. */
export function templateDoc(template: NoteTemplate): DocNode {
  const content: DocNode[] = (() => {
    switch (template) {
      case 'lecture':
        return [
          paragraph(t.lecture.details),
          ...t.lecture.sections.flatMap(section),
          callout('examTip'),
        ];
      case 'drugProfile':
        return [...t.drugProfile.sections.flatMap(section), callout('mnemonic')];
      case 'classComparison':
        return [
          paragraph(t.classComparison.intro),
          table(t.classComparison.columns, 3),
          ...section(t.classComparison.summary),
        ];
      case 'caseSummary':
        return [...t.caseSummary.sections.flatMap(section), callout('clinicalPearl')];
    }
  })();
  return { type: 'doc', content };
}

/**
 * True when nothing was added to a template: the same text and no images. Leaving such a note
 * discards it, like a blank one. Compares text rather than JSON, which the editor may tidy.
 */
export function isUntouchedTemplate(doc: DocNode, template: string | null): boolean {
  if (!isNoteTemplate(template) || mediaIdsInDoc(doc).length > 0) return false;
  return docToText(doc) === docToText(templateDoc(template));
}

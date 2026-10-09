import { strings } from '@/i18n/strings';
import { createTestDatabase } from '@/test-utils/db';

import { docToText, isDocEmpty, noteDocSchema, type DocNode } from '../logic';
import { createNote, discardIfBlank, getNote, saveNoteContent } from '../repo';
import { isNoteTemplate, isUntouchedTemplate, noteTemplates, templateDoc } from '../templates';

const owner = 'owner-1';

describe('note templates', () => {
  it.each(noteTemplates)('%s is a valid, non-empty note body', (template) => {
    const doc = templateDoc(template);
    expect(noteDocSchema.safeParse(doc).success).toBe(true);
    expect(isDocEmpty(doc)).toBe(false);
    expect(strings.notes.templates.names[template]).toBeTruthy();
  });

  it('gives the drug profile the headings from the spec', () => {
    const text = docToText(templateDoc('drugProfile'));
    for (const heading of ['MOA', 'PK', 'Uses', 'ADRs', 'CIs', 'Interactions', 'Dose']) {
      expect(text).toContain(heading);
    }
  });

  it('puts a comparison table in the class comparison', () => {
    const doc = templateDoc('classComparison');
    expect(doc.content?.some((node) => node.type === 'table')).toBe(true);
  });

  it('knows its own names', () => {
    expect(isNoteTemplate('lecture')).toBe(true);
    expect(isNoteTemplate('blank')).toBe(false);
    expect(isNoteTemplate(null)).toBe(false);
  });

  it('tells an untouched template from one with something added', () => {
    const doc = templateDoc('lecture');
    expect(isUntouchedTemplate(doc, 'lecture')).toBe(true);
    expect(isUntouchedTemplate(doc, null)).toBe(false);

    const typed: DocNode = {
      ...doc,
      content: [
        ...(doc.content ?? []),
        { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
      ],
    };
    expect(isUntouchedTemplate(typed, 'lecture')).toBe(false);

    const withImage: DocNode = {
      ...doc,
      content: [...(doc.content ?? []), { type: 'image', attrs: { src: 'media://abc' } }],
    };
    expect(isUntouchedTemplate(withImage, 'lecture')).toBe(false);
  });

  it('creates a note from a template and discards it if left untouched', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner, template: 'caseSummary' });
    expect(note.template).toBe('caseSummary');
    expect(JSON.parse(note.contentJson)).toEqual(templateDoc('caseSummary'));
    expect(note.wordCount).toBeGreaterThan(0);
    expect(await discardIfBlank(db, note.id)).toBe(true);
    expect((await getNote(db, note.id))?.deletedAt).not.toBeNull();
  });

  it('keeps a template note once something is written in it', async () => {
    const db = createTestDatabase();
    const note = await createNote(db, { ownerId: owner, template: 'drugProfile' });
    const doc = templateDoc('drugProfile');
    doc.content = [
      ...(doc.content ?? []),
      { type: 'paragraph', content: [{ type: 'text', text: 'SAMPLE' }] },
    ];
    await saveNoteContent(db, note.id, doc);
    expect(await discardIfBlank(db, note.id)).toBe(false);
  });
});

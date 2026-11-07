import { readFileSync } from 'fs';
import { join } from 'path';

import {
  inlineNodes,
  NOTES_IMPORT_NOTES_MAX,
  planNotesCsvImport,
  planNotesImport,
  rowBlocks,
  textToBlocks,
} from '../csv';
import { docToText, noteDocSchema, type DocNode } from '../logic';

// SAMPLE content for tests only.

function plan(csv: string) {
  const result = planNotesCsvImport(csv);
  if (!result.ok) throw new Error(`expected a plan, got ${result.error}`);
  return result.plan;
}

const types = (nodes: readonly DocNode[]) => nodes.map((n) => n.type);

describe('inline text', () => {
  it('turns **double stars** into bold', () => {
    expect(inlineNodes('a **b** c')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' c' },
    ]);
  });

  it('gives no nodes for an empty line', () => {
    expect(inlineNodes('')).toEqual([]);
  });
});

describe('text to blocks', () => {
  it('makes paragraphs, bullets, numbers and checklists', () => {
    const blocks = textToBlocks('Intro\n- one\n- two\n1. first\n[x] done\n[ ] not yet\nEnd');
    expect(types(blocks)).toEqual([
      'paragraph',
      'bulletList',
      'orderedList',
      'taskList',
      'paragraph',
    ]);
    expect(blocks[1].content).toHaveLength(2);
    expect(blocks[3].content?.map((item) => item.attrs?.checked)).toEqual([true, false]);
  });

  it('starts a new list after a blank line', () => {
    expect(types(textToBlocks('- a\n\n- b'))).toEqual(['bulletList', 'bulletList']);
  });

  it('makes every line a checklist item for the checklist kind', () => {
    const [list] = textToBlocks('one\n- two', true);
    expect(list.type).toBe('taskList');
    expect(list.content).toHaveLength(2);
  });

  it('wraps callouts, quotes and code', () => {
    expect(rowBlocks('Remember this', 'mnemonic')[0]).toMatchObject({
      type: 'callout',
      attrs: { kind: 'mnemonic' },
    });
    expect(rowBlocks('Said someone', 'quote')[0].type).toBe('blockquote');
    const code = rowBlocks('a = 1\n\nb = 2', 'code');
    expect(code).toHaveLength(3);
    expect(code[0].content?.[0].marks).toEqual([{ type: 'code' }]);
  });
});

describe('planNotesCsvImport', () => {
  it('joins rows with the same title into one note, in file order', () => {
    const { notes, skipped } = plan(
      'note,section,text\nA,Intro,one\nB,,two\nA,Intro,three\nA,More,four',
    );
    expect(skipped).toEqual([]);
    expect(notes.map((n) => n.title)).toEqual(['A', 'B']);
    // "Intro" is written once, because the next row of A repeats it.
    expect(docToText(notes[0].doc)).toBe('Intro\none\nthree\nMore\nfour');
  });

  it('carries on the note above when the note cell is empty', () => {
    const { notes } = plan('note,text\nA,one\n,two');
    expect(notes).toHaveLength(1);
    expect(docToText(notes[0].doc)).toBe('one\ntwo');
  });

  it('skips rows with no note to belong to, or a kind it does not know', () => {
    const { notes, skipped } = plan('note,text,kind\n,orphan,\nA,one,\nA,two,sparkle');
    expect(notes).toHaveLength(1);
    expect(skipped).toEqual([
      { row: 2, reason: 'noNote' },
      { row: 4, reason: 'kindUnknown' },
    ]);
  });

  it('reads header names in any case, and their other names', () => {
    const { notes } = plan('Title,Heading,Content,Type,Template\nA,H,body,tip,Concept sheet');
    expect(notes[0].template).toBe('concept');
    expect(types(notes[0].doc.content ?? [])).toEqual(['heading', 'callout']);
  });

  it('labels the note with a known sheet only', () => {
    expect(plan('note,text,sheet\nA,x,classDay').notes[0].template).toBe('classDay');
    expect(plan('note,text,sheet\nA,x,poster').notes[0].template).toBeNull();
  });

  it('turns a written-out \\n into a new line, except in code', () => {
    const text = plan('note,text\nA,one\\ntwo').notes[0].doc;
    expect(docToText(text)).toBe('one\ntwo');
    const code = plan('note,text,kind\nA,print("a\\nb"),code').notes[0].doc;
    expect(docToText(code)).toBe('print("a\\nb")');
  });

  it('makes valid note bodies', () => {
    const { notes } = plan('note,section,text,kind\nA,S,"- a\n[ ] b",\nA,,m,mnemonic');
    for (const note of notes) expect(noteDocSchema.safeParse(note.doc).success).toBe(true);
  });

  it('explains files it cannot use', () => {
    expect(planNotesCsvImport('')).toEqual({ ok: false, error: 'empty' });
    expect(planNotesCsvImport('front,back\na,b')).toEqual({ ok: false, error: 'noHeader' });
    expect(planNotesCsvImport('note,text\n,orphan')).toEqual({ ok: false, error: 'noNotes' });
    expect(planNotesCsvImport('note,text\n,')).toEqual({ ok: false, error: 'empty' });
  });

  it('stops at the most notes a file can hold', () => {
    const rows = Array.from({ length: NOTES_IMPORT_NOTES_MAX + 2 }, (_, i) => `N${i},x`);
    const { notes, skipped } = plan(`note,text\n${rows.join('\n')}`);
    expect(notes).toHaveLength(NOTES_IMPORT_NOTES_MAX);
    expect(skipped.map((s) => s.reason)).toEqual(['tooManyNotes', 'tooManyNotes']);
  });

  it('reads semicolon files and a byte-order mark', () => {
    expect(plan('﻿note;text\nA;one').notes).toHaveLength(1);
  });
});

describe('planNotesImport', () => {
  it('leaves out notes with the same title and text as one already there', () => {
    const { notes } = plan('note,text\nA,one\nB,two');
    const effect = planNotesImport(notes, [{ title: 'a', contentText: 'one' }]);
    expect(effect.alreadyThere).toBe(1);
    expect(effect.toAdd.map((n) => n.title)).toEqual(['B']);
  });

  it('keeps a note whose title matches but whose text is new', () => {
    const { notes } = plan('note,text\nA,new text');
    expect(planNotesImport(notes, [{ title: 'A', contentText: 'old' }]).toAdd).toHaveLength(1);
  });
});

describe('the sample file in docs/samples', () => {
  it('imports every row', () => {
    const csv = readFileSync(
      join(__dirname, '../../../../docs/samples/notes-import-sample.csv'),
      'utf8',
    );
    const { notes, skipped } = plan(csv);
    expect(skipped).toEqual([]);
    expect(notes.map((n) => n.title)).toEqual([
      'SAMPLE: Binary search',
      'SAMPLE: OSI model',
      'SAMPLE: Week 6 class',
    ]);
    expect(notes.map((n) => n.template)).toEqual(['concept', 'concept', 'classDay']);
    for (const note of notes) expect(noteDocSchema.safeParse(note.doc).success).toBe(true);
  });
});

describe('the example in docs/NOTES_CSV_FOR_CHATBOTS.md', () => {
  it('imports cleanly, so the guide teaches a format the app reads', () => {
    const guide = readFileSync(
      join(__dirname, '../../../../docs/NOTES_CSV_FOR_CHATBOTS.md'),
      'utf8',
    );
    const blocks = [...guide.matchAll(/```csv\n([\s\S]*?)```/g)].map((m) => m[1]);
    const example = blocks.find((block) => block.includes('Binary search'));
    expect(example).toBeDefined();
    const { notes, skipped } = plan(example ?? '');
    expect(skipped).toEqual([]);
    expect(notes.map((n) => n.title)).toEqual(['Binary search', 'OSI model']);
    expect(notes[0].doc.content?.some((n) => n.type === 'orderedList')).toBe(true);
  });
});

import { detectSeparator, parseCsv, readDirectives } from '@/features/decks/csv';

import { cleanTitle, docToText, type CalloutKind, type DocNode } from './logic';
import { isNoteTemplate, noteTemplates, type NoteTemplate } from './templates';

// CSV import for notes (2026-11-07, at the developer's request), like the quiz import: a format
// simple enough that a person, a spreadsheet or (later) an AI can turn any notes into it. Pure:
// no React and no database, so it is unit-tested. One row per part of a note:
//
//   note,section,text,kind,sheet
//   Binary search,In one line,Find an item in a sorted list by halving the search.,,concept
//   Binary search,Steps,"- Look at the middle
//   - Go left or right
//   - Repeat",,
//   Binary search,,Please Do Not Throw Sausage Pizza Away,mnemonic,
//
// - `note` (required): the note's title. Rows with the same title join into one note, in file
//   order. A row with an empty `note` carries on the note above it.
// - `section`: a heading. When it repeats the row above's heading, it isn't written twice.
// - `text` (required): the words. Each line is a paragraph; lines starting "- " or "* " are
//   bullets, "1. " numbered, "[ ] " or "[x] " a checklist. **Double stars** make bold.
//   A literal "\n" also starts a new line (chatbots often write it).
// - `kind`: text (default), mnemonic, tip, warning, pearl, code (code type), quote or checklist.
// - `sheet`: the template the note is filed under (concept, classDay, …). Only labels the note.

export const NOTES_IMPORT_ROWS_MAX = 2000;
export const NOTES_IMPORT_NOTES_MAX = 300;
/** The longest cell the import accepts, in characters. */
export const NOTES_IMPORT_CELL_MAX = 20000;

type Column = 'note' | 'section' | 'text' | 'kind' | 'sheet';

const HEADER_ALIASES: Record<string, Column> = {
  note: 'note',
  title: 'note',
  'note title': 'note',
  section: 'section',
  heading: 'section',
  box: 'section',
  text: 'text',
  content: 'text',
  body: 'text',
  kind: 'kind',
  type: 'kind',
  block: 'kind',
  sheet: 'sheet',
  template: 'sheet',
};

/** The kinds of block a row can be. */
export type NoteBlockKind = 'text' | 'code' | 'quote' | 'checklist' | CalloutKind;

const KIND_NAMES: Record<string, NoteBlockKind> = {
  '': 'text',
  text: 'text',
  paragraph: 'text',
  notes: 'text',
  bullets: 'text',
  list: 'text',
  mnemonic: 'mnemonic',
  tip: 'examTip',
  'exam tip': 'examTip',
  examtip: 'examTip',
  warning: 'warning',
  caution: 'warning',
  pearl: 'clinicalPearl',
  'clinical pearl': 'clinicalPearl',
  clinicalpearl: 'clinicalPearl',
  code: 'code',
  quote: 'quote',
  checklist: 'checklist',
  todo: 'checklist',
  tasks: 'checklist',
};

/** Sheet names a file may use, besides the template keys themselves. */
const SHEET_NAMES: Record<string, NoteTemplate> = {
  'concept sheet': 'concept',
  'class day': 'classDay',
  class: 'classDay',
  'exam revision': 'examRevision',
  revision: 'examRevision',
  'bug diary': 'bugDiary',
  bug: 'bugDiary',
  'compare two things': 'compare',
  comparison: 'compare',
  'lecture notes': 'lecture',
  'drug profile': 'drugProfile',
  'class comparison': 'classComparison',
  'case summary': 'caseSummary',
};

function sheetOf(cell: string): NoteTemplate | null {
  const name = cell.trim();
  if (!name) return null;
  const key = noteTemplates.find((t) => t.toLowerCase() === name.toLowerCase());
  if (key) return key;
  const named = SHEET_NAMES[name.toLowerCase()];
  return isNoteTemplate(named) ? named : null;
}

export type NotesImportSkipReason = 'noNote' | 'kindUnknown' | 'tooLong' | 'tooManyNotes';

export type ImportedNote = {
  title: string;
  template: NoteTemplate | null;
  doc: DocNode;
};

export type NotesCsvImportPlan = {
  /** Notes ready to save, in the order they first appear in the file. */
  notes: ImportedNote[];
  /** Rows that can't be used, by their line in the file (1 = the header). */
  skipped: { row: number; reason: NotesImportSkipReason }[];
  truncated: boolean;
};

export type NotesCsvImportError = 'empty' | 'noHeader' | 'noNotes';

// ---------------------------------------------------------------------------------------------
// Text → editor blocks

const text = (value: string, bold = false): DocNode =>
  bold ? { type: 'text', text: value, marks: [{ type: 'bold' }] } : { type: 'text', text: value };

/** One line's inline content: plain text with **bold** parts. Empty text has no nodes. */
export function inlineNodes(line: string): DocNode[] {
  const nodes: DocNode[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    nodes.push(bold ? text(bold[1], true) : text(part));
  }
  return nodes;
}

const paragraph = (line: string): DocNode => {
  const content = inlineNodes(line);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
};

type LineKind = 'bullet' | 'number' | 'check' | 'plain';

function readLine(line: string): { kind: LineKind; body: string; checked?: boolean } {
  const check = /^\s*(?:[-*•]\s+)?\[( |x|X)\]\s+(.*)$/.exec(line);
  if (check) return { kind: 'check', body: check[2], checked: check[1] !== ' ' };
  const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
  if (bullet) return { kind: 'bullet', body: bullet[1] };
  const number = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line);
  if (number) return { kind: 'number', body: number[1] };
  return { kind: 'plain', body: line.trim() };
}

/** Lines of text as paragraphs and lists. `checklist` makes every line a checklist item. */
export function textToBlocks(value: string, checklist = false): DocNode[] {
  const lines = value.split('\n');
  const blocks: DocNode[] = [];
  let list: { kind: Exclude<LineKind, 'plain'>; items: DocNode[] } | null = null;
  const flush = () => {
    if (!list) return;
    const type = { bullet: 'bulletList', number: 'orderedList', check: 'taskList' }[list.kind];
    blocks.push({ type, content: list.items });
    list = null;
  };
  for (const raw of lines) {
    if (!raw.trim()) {
      flush();
      continue;
    }
    let line = readLine(raw);
    if (checklist && line.kind !== 'check') {
      line = { kind: 'check', body: line.body, checked: false };
    }
    if (line.kind === 'plain') {
      flush();
      blocks.push(paragraph(line.body));
      continue;
    }
    if (!list || list.kind !== line.kind) {
      flush();
      list = { kind: line.kind, items: [] };
    }
    list.items.push(
      line.kind === 'check'
        ? { type: 'taskItem', attrs: { checked: !!line.checked }, content: [paragraph(line.body)] }
        : { type: 'listItem', content: [paragraph(line.body)] },
    );
  }
  flush();
  return blocks;
}

/** One row's text as blocks of the given kind. */
export function rowBlocks(value: string, kind: NoteBlockKind): DocNode[] {
  if (kind === 'code') {
    // The editor has inline code but no code block, so each line is a paragraph in code type.
    return value.split('\n').map((line) =>
      line
        ? {
            type: 'paragraph',
            content: [{ type: 'text', text: line, marks: [{ type: 'code' }] }],
          }
        : { type: 'paragraph' },
    );
  }
  const blocks = textToBlocks(value, kind === 'checklist');
  if (blocks.length === 0) return [];
  if (kind === 'quote') return [{ type: 'blockquote', content: blocks }];
  if (kind === 'text' || kind === 'checklist') return blocks;
  return [{ type: 'callout', attrs: { kind }, content: blocks }];
}

const heading = (value: string): DocNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: inlineNodes(value),
});

// ---------------------------------------------------------------------------------------------
// The file

type Columns = Map<Column, number>;

function headerColumns(row: readonly string[]): Columns | null {
  const columns: Columns = new Map();
  row.forEach((cell, index) => {
    const column = HEADER_ALIASES[cell.trim().toLowerCase()];
    if (column && !columns.has(column)) columns.set(column, index);
  });
  return columns.has('note') && columns.has('text') ? columns : null;
}

/** A cell's text with Windows line endings and written-out "\n" turned into new lines. */
function cellText(value: string, keepEscapes: boolean): string {
  const lines = value.replace(/\r\n?/g, '\n');
  return keepEscapes ? lines : lines.replace(/\\n/g, '\n');
}

type Building = {
  title: string;
  template: NoteTemplate | null;
  content: DocNode[];
  lastSection: string | null;
};

/** Reads a notes CSV into notes, with the rows that can't be used and why. */
export function planNotesCsvImport(
  input: string,
): { ok: true; plan: NotesCsvImportPlan } | { ok: false; error: NotesCsvImportError } {
  const source = input.replace(/^﻿/, '');
  const { body, options } = readDirectives(source);
  const rows = parseCsv(body, options.separator ?? detectSeparator(body));
  if (rows.length === 0) return { ok: false, error: 'empty' };
  const columns = headerColumns(rows[0]);
  if (!columns) return { ok: false, error: 'noHeader' };

  const cell = (row: readonly string[], column: Column) => {
    const index = columns.get(column);
    return index === undefined ? '' : (row[index] ?? '');
  };

  const byTitle = new Map<string, Building>();
  const order: Building[] = [];
  const skipped: NotesCsvImportPlan['skipped'] = [];
  let current: Building | null = null;

  const dataRows = rows.slice(1, 1 + NOTES_IMPORT_ROWS_MAX);
  dataRows.forEach((row, i) => {
    const rowNumber = i + 2;
    const kindName = cell(row, 'kind').trim().toLowerCase();
    const kind = KIND_NAMES[kindName];
    const value = cellText(cell(row, 'text'), kind === 'code').trim();
    const section = cleanTitle(cell(row, 'section'));
    const title = cleanTitle(cell(row, 'note'));
    if (!title && !value && !section) return;

    if (kind === undefined) {
      skipped.push({ row: rowNumber, reason: 'kindUnknown' });
      return;
    }
    if (value.length > NOTES_IMPORT_CELL_MAX) {
      skipped.push({ row: rowNumber, reason: 'tooLong' });
      return;
    }
    if (title) {
      const key = title.toLowerCase();
      let note = byTitle.get(key);
      if (!note) {
        if (order.length >= NOTES_IMPORT_NOTES_MAX) {
          skipped.push({ row: rowNumber, reason: 'tooManyNotes' });
          current = null;
          return;
        }
        note = { title, template: null, content: [], lastSection: null };
        byTitle.set(key, note);
        order.push(note);
      }
      current = note;
    }
    const note = current as Building | null;
    if (!note) {
      skipped.push({ row: rowNumber, reason: 'noNote' });
      return;
    }
    note.template ??= sheetOf(cell(row, 'sheet'));
    if (section && section.toLowerCase() !== note.lastSection?.toLowerCase()) {
      note.content.push(heading(section));
      note.lastSection = section;
    }
    if (value) note.content.push(...rowBlocks(value, kind));
  });

  const notes = order.map((note): ImportedNote => ({
    title: note.title,
    template: note.template,
    doc: {
      type: 'doc',
      content: note.content.length > 0 ? note.content : [{ type: 'paragraph' }],
    },
  }));
  if (notes.length === 0) {
    return { ok: false, error: skipped.length > 0 ? 'noNotes' : 'empty' };
  }
  return {
    ok: true,
    plan: { notes, skipped, truncated: rows.length - 1 > NOTES_IMPORT_ROWS_MAX },
  };
}

/** A note's title and text, for spotting a note that is already there. */
export function noteMatchKey(note: { title: string; contentText: string }): string {
  return `${note.title.trim().toLowerCase()}\u0000${note.contentText.trim()}`;
}

export type NotesImportEffect = {
  toAdd: ImportedNote[];
  /** Notes with the same title and text as one the student already has: left out. */
  alreadyThere: number;
};

/** What an import adds: every note except ones already there, so importing twice is safe. */
export function planNotesImport(
  imported: readonly ImportedNote[],
  existing: readonly { title: string; contentText: string }[],
): NotesImportEffect {
  const have = new Set(existing.map(noteMatchKey));
  const effect: NotesImportEffect = { toAdd: [], alreadyThere: 0 };
  for (const note of imported) {
    const key = noteMatchKey({ title: note.title, contentText: docToText(note.doc) });
    if (have.has(key)) effect.alreadyThere += 1;
    else {
      have.add(key);
      effect.toAdd.push(note);
    }
  }
  return effect;
}

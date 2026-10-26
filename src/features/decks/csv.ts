import type { CardType } from '@/db/schema';
import { cleanName, TAG_NAME_MAX } from '@/features/library/logic';

import {
  cardDraftProblem,
  docToField,
  emptyField,
  parseCloze,
  type CardDraft,
  type CardProblem,
  type EditableCardType,
} from './logic';

// CSV import and export for decks (PRODUCT_SPEC §4.2: "CSV (front, back, tags)"). Pure: the
// file picker, file writing and the database live elsewhere, so all of this is unit-tested.
//
// What a file looks like when Dozi writes it:
//
//   front,back,tags,extra,type
//   Propranolol class,Non-selective beta blocker,"Year 2,",,basic
//
// Reading is forgiving: a header row is optional (without one the columns are front, back,
// tags), the separator can be a comma, semicolon or tab, and Anki's plain-text export works
// (its `#separator:` lines and simple HTML are understood).

// ---------------------------------------------------------------------------------------------
// CSV text ↔ rows (RFC 4180)

export type CsvSeparator = ',' | ';' | '\t';

/** The separators Anki names in a `#separator:` line. */
const ANKI_SEPARATORS: Record<string, CsvSeparator> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
};

/** Guesses the separator from the first line: whichever of tab, semicolon or comma is most used. */
export function detectSeparator(text: string): CsvSeparator {
  const firstLine = splitFirstLine(text);
  const count = (ch: string) => {
    let n = 0;
    let quoted = false;
    for (const c of firstLine) {
      if (c === '"') quoted = !quoted;
      else if (!quoted && c === ch) n += 1;
    }
    return n;
  };
  const candidates: CsvSeparator[] = ['\t', ';', ','];
  let best: CsvSeparator = ',';
  let bestCount = 0;
  for (const sep of candidates) {
    const n = count(sep);
    if (n > bestCount) {
      best = sep;
      bestCount = n;
    }
  }
  return best;
}

function splitFirstLine(text: string): string {
  const end = text.search(/\r?\n/);
  return end === -1 ? text : text.slice(0, end);
}

/**
 * Splits CSV text into rows of cells. Quoted cells may hold separators, quotes ("" for one) and
 * line breaks. Line breaks inside cells become \n. Completely empty lines are dropped.
 */
export function parseCsv(
  text: string,
  separator: CsvSeparator = detectSeparator(text),
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(cell);
    cell = '';
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else if (c === '\r') {
        cell += '\n';
        if (text[i + 1] === '\n') i += 1;
      } else {
        cell += c;
      }
      i += 1;
      continue;
    }
    if (c === '"' && cell === '') quoted = true;
    else if (c === separator) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else cell += c;
    i += 1;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

function quoteCell(value: string, separator: CsvSeparator): string {
  return value.includes(separator) || /["\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** Rows as CSV text: comma-separated, CRLF line ends, cells quoted only when they need it. */
export function toCsv(rows: readonly (readonly string[])[], separator: CsvSeparator = ','): string {
  return rows
    .map((row) =>
      row.map((cell) => quoteCell(cell.replace(/\r\n?/g, '\n'), separator)).join(separator),
    )
    .join('\r\n')
    .concat('\r\n');
}

// ---------------------------------------------------------------------------------------------
// Anki-style extras: `#key:value` lines at the top and simple HTML in fields

type FileOptions = { separator: CsvSeparator | null; html: boolean; tagsColumn: number | null };

/** Reads (and removes) Anki's `#separator:tab`, `#html:true` and `#tags column:3` lines. */
export function readDirectives(text: string): { body: string; options: FileOptions } {
  const options: FileOptions = { separator: null, html: false, tagsColumn: null };
  const lines = text.split(/\r?\n/);
  let start = 0;
  while (start < lines.length) {
    const match = /^#([a-z ]+):(.*)$/i.exec(lines[start].trim());
    if (!match) break;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim().toLowerCase();
    if (key === 'separator') {
      const sep = ANKI_SEPARATORS[value] ?? (value === ',' || value === ';' ? value : null);
      if (sep) options.separator = sep as CsvSeparator;
    } else if (key === 'html') {
      options.html = value === 'true';
    } else if (key === 'tags column') {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 1) options.tagsColumn = n - 1;
    }
    start += 1;
  }
  return { body: lines.slice(start).join('\n'), options };
}

const HTML_TAG_NAMES = 'b|i|u|s|em|strong|span|div|p|br|font|sub|sup|ul|ol|li|img|a|hr';
const HTML_TAG = new RegExp(`</?(?:${HTML_TAG_NAMES})\\b[^>]*>`, 'gi');
const HAS_HTML_TAG = new RegExp(`</?(?:${HTML_TAG_NAMES})\\b[^>]*>`, 'i');
const BLOCK_BREAK = '\u0001';
const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Turns simple HTML (what Anki puts in fields) into plain text: line breaks for <br>, <div> and
 * <p>, other tags dropped, entities decoded. Only known tag names are touched, so a field like
 * "K+ < 3.5" is left alone. Images can't come through a CSV, so <img> is dropped too.
 */
export function htmlToText(value: string, force = false): string {
  if (!force && !HAS_HTML_TAG.test(value)) return value;
  return (
    value
      .replace(/<br\s*\/?>/gi, '\n')
      // Block tags start a new line; a run of them (</div><div>) is still one line break.
      .replace(/<\/?(?:div|p|li)\b[^>]*>/gi, BLOCK_BREAK)
      .replace(HTML_TAG, '')
      .replace(/\n?\u0001+\n?/g, '\n')
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
        if (name[0] === '#') {
          const code =
            name[1] === 'x' || name[1] === 'X'
              ? parseInt(name.slice(2), 16)
              : Number(name.slice(1));
          return Number.isFinite(code) && code > 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : whole;
        }
        return HTML_ENTITIES[name.toLowerCase()] ?? whole;
      })
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

// ---------------------------------------------------------------------------------------------
// Tags

/** The most tags one import adds to the deck. */
export const IMPORT_TAGS_MAX = 20;

/**
 * Splits a tags cell. Commas or semicolons separate tags when there are any (so "Year 2," is
 * one tag with a space); otherwise spaces do, like Anki ("pharm ans").
 */
export function splitTags(cell: string): string[] {
  const parts = /[,;]/.test(cell) ? cell.split(/[,;]/) : cell.split(/\s+/);
  return parts.map(cleanName).filter((t) => t !== '');
}

/** A deck's tags as one cell. A single tag gets a trailing comma so its spaces survive. */
export function joinTags(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return /\s/.test(names[0]) ? `${names[0]},` : names[0];
  return names.join(', ');
}

// ---------------------------------------------------------------------------------------------
// Rows ↔ cards

/** The columns Dozi writes, in this order (front, back, tags first, as in the spec). */
export const CSV_HEADER = ['front', 'back', 'tags', 'extra', 'type'] as const;
type Column = (typeof CSV_HEADER)[number];

/** Other header names that mean the same column (Anki's and common spreadsheet ones). */
const HEADER_ALIASES: Record<string, Column> = {
  front: 'front',
  question: 'front',
  text: 'front',
  back: 'back',
  answer: 'back',
  tags: 'tags',
  tag: 'tags',
  extra: 'extra',
  'back extra': 'extra',
  notes: 'extra',
  type: 'type',
  'card type': 'type',
};

/** Words accepted in the type column, mapped to Dozi's card types. */
const TYPE_NAMES: Record<string, EditableCardType> = {
  basic: 'basic',
  basic_reverse: 'basic_reverse',
  'basic + reverse': 'basic_reverse',
  'basic (and reversed card)': 'basic_reverse',
  reverse: 'basic_reverse',
  reversed: 'basic_reverse',
  cloze: 'cloze',
  type_in: 'type_in',
  'type-in': 'type_in',
  'type in': 'type_in',
  'basic (type in the answer)': 'type_in',
};

export const IMPORT_ROWS_MAX = 5000;

export type ImportSkipReason = CardProblem | 'imageOcclusion';

export type CsvImportPlan = {
  /** Cards ready to save, in file order. */
  drafts: CardDraft[];
  /** Tags found in the file, cleaned, without repeats (ignoring case), at most IMPORT_TAGS_MAX. */
  tags: string[];
  /** Rows that can't become a card, by their line in the file (1 = first row). */
  skipped: { row: number; reason: ImportSkipReason }[];
  /** True when the file had more than IMPORT_ROWS_MAX rows (the rest were left out). */
  truncated: boolean;
};

export type CsvImportError = 'empty' | 'noCards';

function headerColumns(row: readonly string[]): Map<Column, number> | null {
  const columns = new Map<Column, number>();
  row.forEach((cell, index) => {
    const column = HEADER_ALIASES[cell.trim().toLowerCase()];
    if (column && !columns.has(column)) columns.set(column, index);
  });
  return columns.has('front') ? columns : null;
}

function typeFor(cell: string | undefined, front: string): EditableCardType | 'image_occlusion' {
  const name = (cell ?? '').trim().toLowerCase();
  if (name === 'image_occlusion' || name === 'image occlusion') return 'image_occlusion';
  const named = TYPE_NAMES[name];
  if (named) return named;
  return parseCloze(front).some((p) => p.type === 'cloze') ? 'cloze' : 'basic';
}

/** Reads a CSV file's text into cards for one deck, with the rows that can't be cards. */
export function planCsvImport(
  input: string,
): { ok: true; plan: CsvImportPlan } | { ok: false; error: CsvImportError } {
  const text = input.replace(/^﻿/, '');
  const { body, options } = readDirectives(text);
  const rows = parseCsv(body, options.separator ?? detectSeparator(body));
  if (rows.length === 0) return { ok: false, error: 'empty' };

  const header = headerColumns(rows[0]);
  const columns =
    header ??
    new Map<Column, number>([
      ['front', 0],
      ['back', 1],
      ['tags', options.tagsColumn ?? 2],
    ]);
  if (!header && options.tagsColumn !== null) columns.set('tags', options.tagsColumn);
  const firstData = header ? 1 : 0;
  const dataRows = rows.slice(firstData, firstData + IMPORT_ROWS_MAX);
  const truncated = rows.length - firstData > IMPORT_ROWS_MAX;

  const cell = (row: readonly string[], column: Column) => {
    const index = columns.get(column);
    if (index === undefined) return '';
    return htmlToText(row[index] ?? '', options.html).replace(/\r\n?/g, '\n');
  };

  const plan: CsvImportPlan = { drafts: [], tags: [], skipped: [], truncated };
  const seenTags = new Set<string>();
  dataRows.forEach((row, i) => {
    const rowNumber = firstData + i + 1;
    const front = cell(row, 'front');
    const back = cell(row, 'back');
    let extra = cell(row, 'extra');
    if (front.trim() === '' && back.trim() === '' && extra.trim() === '') return;

    for (const tag of splitTags(cell(row, 'tags'))) {
      const key = tag.toLowerCase();
      if (seenTags.has(key) || tag.length > TAG_NAME_MAX) continue;
      if (plan.tags.length >= IMPORT_TAGS_MAX) break;
      seenTags.add(key);
      plan.tags.push(tag);
    }

    const type = typeFor(row[columns.get('type') ?? -1], front);
    if (type === 'image_occlusion') {
      plan.skipped.push({ row: rowNumber, reason: 'imageOcclusion' });
      return;
    }
    // Anki's cloze cards keep their "Back Extra" in the second column.
    let backText = back;
    if (type === 'cloze' && back.trim() !== '' && extra.trim() === '') {
      extra = back;
      backText = '';
    }
    const draft: CardDraft = {
      type,
      front: { text: front.trim(), mediaIds: [] },
      back: { text: backText.trim(), mediaIds: [] },
      extra: { text: extra.trim(), mediaIds: [] },
    };
    if (type === 'cloze') draft.back = emptyField();
    const problem = cardDraftProblem(draft);
    if (problem) plan.skipped.push({ row: rowNumber, reason: problem });
    else plan.drafts.push(draft);
  });

  if (plan.drafts.length === 0 && plan.skipped.length === 0) return { ok: false, error: 'empty' };
  if (plan.drafts.length === 0) return { ok: false, error: 'noCards' };
  return { ok: true, plan };
}

export type ExportableCard = {
  type: CardType;
  frontJson: string;
  backJson: string;
  extraJson: string | null;
};

export type CsvExport = {
  csv: string;
  /** Cards written to the file. */
  exported: number;
  /** Image occlusion cards, which a CSV can't hold. */
  leftOut: number;
  /** Cards written without their images (only the text goes in a CSV). */
  withoutImages: number;
};

/**
 * A deck as CSV text, with a header row. Cloze cards keep their {{c1::…}} markers so they come
 * back as cloze cards; the deck's tags go on every row. Starts with a byte-order mark so
 * spreadsheet apps read the file as UTF-8 (Greek letters, µg).
 */
export function deckToCsv(
  cards: readonly ExportableCard[],
  tagNames: readonly string[],
): CsvExport {
  const rows: string[][] = [[...CSV_HEADER]];
  const tags = joinTags(tagNames);
  let leftOut = 0;
  let withoutImages = 0;
  for (const card of cards) {
    if (card.type === 'image_occlusion') {
      leftOut += 1;
      continue;
    }
    const front = docToField(card.frontJson);
    const back = docToField(card.backJson);
    const extra = docToField(card.extraJson);
    if (front.mediaIds.length + back.mediaIds.length + extra.mediaIds.length > 0) {
      withoutImages += 1;
    }
    rows.push([front.text, card.type === 'cloze' ? '' : back.text, tags, extra.text, card.type]);
  }
  return { csv: `﻿${toCsv(rows)}`, exported: rows.length - 1, leftOut, withoutImages };
}

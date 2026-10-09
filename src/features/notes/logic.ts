import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';

import { parseMediaRef } from '@/features/media/logic';
import { DEFAULT_TIMEZONE } from '@/lib/time';

export * from './callouts';

// Pure rules for notes (PRODUCT_SPEC §4.1): the editor's ProseMirror JSON, plain text and word
// count, titles, versions and autosave timing. No React and no database, so it is unit-tested.

// ---------------------------------------------------------------------------------------------
// Content (ProseMirror JSON)

/** One node of the editor's document. Only the fields the app reads are typed. */
export type DocNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

const docNodeSchema: z.ZodType<DocNode> = z.lazy(() =>
  z.looseObject({
    type: z.string().min(1),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(docNodeSchema).optional(),
    marks: z
      .array(
        z.looseObject({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }),
      )
      .optional(),
  }),
);

/** A whole note body: a `doc` node at the top. */
export const noteDocSchema = docNodeSchema.refine((node) => node.type === 'doc', {
  message: 'A note body must start with a doc node',
});

/** A blank note: one empty paragraph. */
export function emptyDoc(): DocNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** Reads `notes.content_json`. Throws if it isn't a valid note body. */
export function parseNoteContent(json: string): DocNode {
  return noteDocSchema.parse(JSON.parse(json));
}

/** Checks something that claims to be a note body (e.g. a message from the editor). */
export function toNoteDoc(value: unknown): DocNode | null {
  const result = noteDocSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Nodes whose children are inline text: each becomes one line of plain text. */
const textBlocks = new Set(['paragraph', 'heading', 'codeBlock']);

/**
 * The note as plain text, one line per paragraph, heading, list item or table cell.
 * Used for previews, the word count and (task 1.4) search.
 */
export function docToText(doc: DocNode): string {
  const lines: string[] = [];
  const inline = (node: DocNode): string => {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    return (node.content ?? []).map(inline).join('');
  };
  const walk = (node: DocNode) => {
    if (textBlocks.has(node.type)) {
      lines.push(...inline(node).split('\n'));
      return;
    }
    if (node.type === 'text') {
      lines.push(node.text ?? '');
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}

/** Words in plain text: runs of non-spaces with at least one letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** The ids of every `media://` image in a note, in order, without repeats. */
export function mediaIdsInDoc(doc: DocNode): string[] {
  const ids: string[] = [];
  const walk = (node: DocNode) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      const id = parseMediaRef(node.attrs.src);
      if (id && !ids.includes(id)) ids.push(id);
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return ids;
}

/** True when a note body has no text, images, tables or dividers — nothing worth keeping. */
export function isDocEmpty(doc: DocNode): boolean {
  const hasSomething = (node: DocNode): boolean => {
    if (node.type === 'text') return (node.text ?? '').trim() !== '';
    if (node.type === 'image' || node.type === 'horizontalRule' || node.type === 'table') {
      return true;
    }
    return (node.content ?? []).some(hasSomething);
  };
  return !hasSomething(doc);
}

/** What gets saved for a note body: the JSON plus its plain text and word count. */
export function summariseContent(doc: DocNode): {
  contentJson: string;
  contentText: string;
  wordCount: number;
} {
  const contentText = docToText(doc);
  return { contentJson: JSON.stringify(doc), contentText, wordCount: countWords(contentText) };
}

// ---------------------------------------------------------------------------------------------
// Titles

export const NOTE_TITLE_MAX = 120;

/** Trims the title, joins it onto one line and keeps it under the limit. */
export function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, NOTE_TITLE_MAX);
}

/** The first line of a note's text, shortened for a Library row. */
export function notePreview(contentText: string, max = 90): string {
  const first = contentText.split('\n').find((line) => line.trim() !== '') ?? '';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

// ---------------------------------------------------------------------------------------------
// Versions (note history)

/** How many earlier versions each note keeps. */
export const NOTE_VERSION_LIMIT = 10;

/** While someone keeps editing, a new history entry is made at most this often. */
export const NOTE_VERSION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Whether saving new content should first keep the content it replaces as a version.
 * Yes when the content really changes, the old content isn't blank, and the newest version is
 * missing or older than the interval — so history holds snapshots a few minutes apart rather
 * than one per keystroke, and the state before each editing session is always kept.
 */
export function shouldKeepVersion(args: {
  previousJson: string;
  nextJson: string;
  previousIsEmpty: boolean;
  newestVersion: { createdAt: string; contentJson: string } | undefined;
  nowMs: number;
}): boolean {
  const { previousJson, nextJson, previousIsEmpty, newestVersion, nowMs } = args;
  if (previousJson === nextJson || previousIsEmpty) return false;
  if (!newestVersion) return true;
  if (newestVersion.contentJson === previousJson) return false;
  return nowMs - Date.parse(newestVersion.createdAt) >= NOTE_VERSION_INTERVAL_MS;
}

/** Versions beyond the limit (newest are kept). Input in any order; returns ids to delete. */
export function versionsToPrune(
  versions: readonly { id: string; createdAt: string }[],
  limit: number = NOTE_VERSION_LIMIT,
): string[] {
  return [...versions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(limit)
    .map((v) => v.id);
}

/** When a version was saved, in the student's timezone, e.g. "9 Oct, 14:05". */
export function formatVersionTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(iso, timeZone, 'd MMM, HH:mm');
}

// ---------------------------------------------------------------------------------------------
// Autosave

/** Quiet time after the last change before a note is written to the database. */
export const AUTOSAVE_DELAY_MS = 500;

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

// ---------------------------------------------------------------------------------------------
// Search (notes_fts, migration 0004)

/** Longest search text used; anything after it is ignored. */
export const SEARCH_MAX_LENGTH = 100;
/** At most this many words of a search are matched. */
const SEARCH_MAX_TERMS = 8;

/** The words of a search: runs of letters and digits, lower-cased, without repeats. */
export function searchTerms(input: string): string[] {
  const words =
    input
      .slice(0, SEARCH_MAX_LENGTH)
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words)].slice(0, SEARCH_MAX_TERMS);
}

/**
 * An FTS5 MATCH expression for what the student typed: every word must appear, and each word
 * also matches longer words starting with it (`beta` finds `beta-blocker`). Each word is quoted,
 * so FTS5 operators typed by the student (AND, NEAR, *, ") are only ever searched as text.
 * Returns null when there is nothing to search for.
 */
export function toFtsQuery(input: string): string | null {
  const terms = searchTerms(input);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(' ');
}

/** Marks put around matches by SQLite's `snippet()` / `highlight()`; never typed by people. */
export const MATCH_START = '\u0002';
export const MATCH_END = '\u0003';

export type HighlightPart = { text: string; match: boolean };

/** Splits marked text from the search index into plain and matching parts, for drawing. */
export function splitHighlights(marked: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  const push = (text: string, match: boolean) => {
    if (text === '') return;
    const last = parts[parts.length - 1];
    if (last && last.match === match) last.text += text;
    else parts.push({ text, match });
  };
  let match = false;
  let current = '';
  for (const char of marked) {
    if (char === MATCH_START || char === MATCH_END) {
      push(current, match);
      current = '';
      match = char === MATCH_START;
    } else {
      current += char;
    }
  }
  push(current, match);
  // Snippets span line breaks; show them as one line.
  return parts.map((part) => ({ ...part, text: part.text.replace(/\s+/g, ' ') }));
}

import { z } from 'zod';

import { strings } from '@/i18n/strings';

import { docToText, mediaIdsInDoc, type DocNode } from './logic';
import { callout, heading, paragraph, table, type NoteTemplate } from './templates';

// "Build your own sheet" (task 1.14b). Pure, so it is unit-tested.
//
// A sheet is a name and a list of boxes, each with a heading. Sheets are kept on this phone
// only (in the local settings table) for now; notes made from one keep `custom:<name>` as their
// template, so the notes board can still show the sheet's name after the sheet is deleted.

const t = strings.notes.customSheet;

export const customBoxKinds = [
  'notes',
  'list',
  'checklist',
  'table',
  'mnemonic',
  'tip',
  'warning',
  'howSure',
] as const;
export type CustomBoxKind = (typeof customBoxKinds)[number];

export const CUSTOM_SHEETS_KEY = 'notes.customSheets';
export const CUSTOM_SHEETS_MAX = 20;
export const CUSTOM_SHEET_BOXES_MAX = 12;
export const CUSTOM_SHEET_NAME_MAX = 40;
export const CUSTOM_BOX_TITLE_MAX = 60;
const CUSTOM_PREFIX = 'custom:';

const boxSchema = z.object({
  kind: z.enum(customBoxKinds),
  title: z.string().max(CUSTOM_BOX_TITLE_MAX),
});
const sheetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(CUSTOM_SHEET_NAME_MAX),
  boxes: z.array(boxSchema).min(1).max(CUSTOM_SHEET_BOXES_MAX),
});

export type CustomBox = z.infer<typeof boxSchema>;
export type CustomSheet = z.infer<typeof sheetSchema>;

/** The saved sheets. Anything damaged is skipped rather than breaking the list. */
export function parseCustomSheets(value: unknown): CustomSheet[] {
  if (!Array.isArray(value)) return [];
  const sheets: CustomSheet[] = [];
  for (const item of value) {
    const parsed = sheetSchema.safeParse(item);
    if (parsed.success) sheets.push(parsed.data);
  }
  return sheets.slice(0, CUSTOM_SHEETS_MAX);
}

/** A new box with its usual heading. */
export function newBox(kind: CustomBoxKind): CustomBox {
  return { kind, title: t.boxTitles[kind] };
}

export const cleanSheetName = (name: string) =>
  name.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_SHEET_NAME_MAX).trim();

/** Why this sheet can't be saved yet, or null when it can. */
export function sheetProblem(
  name: string,
  boxes: readonly CustomBox[],
  existing: readonly CustomSheet[],
): string | null {
  const clean = cleanSheetName(name);
  if (!clean) return t.nameNeeded;
  const key = clean.toLocaleLowerCase();
  if (existing.some((sheet) => sheet.name.toLocaleLowerCase() === key)) return t.nameTaken;
  if (boxes.length === 0) return t.noBoxes;
  if (existing.length >= CUSTOM_SHEETS_MAX) return t.full(CUSTOM_SHEETS_MAX);
  return null;
}

/** The list with a new sheet added, its name and headings tidied. */
export function addCustomSheet(
  existing: readonly CustomSheet[],
  input: { id: string; name: string; boxes: readonly CustomBox[] },
): CustomSheet[] {
  const sheet: CustomSheet = {
    id: input.id,
    name: cleanSheetName(input.name),
    boxes: input.boxes.slice(0, CUSTOM_SHEET_BOXES_MAX).map((box) => ({
      kind: box.kind,
      title: box.title.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_BOX_TITLE_MAX),
    })),
  };
  return [...existing, sheet];
}

/** Moves one item up (-1) or down (+1); out of range leaves the list as it is. */
export function moveItem<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

const checklist = (labels: readonly string[]): DocNode => ({
  type: 'taskList',
  content: labels.map((label) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [paragraph(label)],
  })),
});

function boxBody(kind: CustomBoxKind): DocNode {
  switch (kind) {
    case 'notes':
      return paragraph();
    case 'list':
      return { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph()] }] };
    case 'checklist':
      return checklist(['']);
    case 'table':
      return table(['', '', ''], 2);
    case 'mnemonic':
      return callout('mnemonic');
    case 'tip':
      return callout('examTip');
    case 'warning':
      return callout('warning');
    case 'howSure':
      return checklist(t.howSureLevels);
  }
}

/** A new note body for a sheet. */
export function customSheetDoc(sheet: Pick<CustomSheet, 'boxes'>): DocNode {
  const content: DocNode[] = [];
  for (const box of sheet.boxes) {
    if (box.title.trim()) content.push(heading(box.title.trim()));
    content.push(boxBody(box.kind));
  }
  return { type: 'doc', content };
}

/** What goes in `notes.template` for a note made from this sheet. */
export const customTemplateValue = (sheet: Pick<CustomSheet, 'name'>) =>
  `${CUSTOM_PREFIX}${sheet.name}`;

/** The sheet name inside a `custom:<name>` template, or null for anything else. */
export function customSheetName(template: string | null | undefined): string | null {
  if (!template?.startsWith(CUSTOM_PREFIX)) return null;
  return template.slice(CUSTOM_PREFIX.length).trim() || null;
}

/**
 * True when a note from a sheet still has only what the sheet put there: headings, empty
 * boxes and the untouched "How sure am I?" levels. Such a note is dropped if left blank.
 */
export function isUntouchedCustomSheet(doc: DocNode): boolean {
  if (mediaIdsInDoc(doc).length > 0) return false;
  const levels = new Set<string>(t.howSureLevels);
  const hasOwnText = (node: DocNode): boolean => {
    if (node.type === 'heading') return false;
    if (node.type === 'taskItem' && !node.attrs?.checked) {
      const line = docToText({ type: 'doc', content: node.content ?? [] });
      if (levels.has(line)) return false;
    }
    if (node.type === 'text') return (node.text ?? '').trim() !== '';
    return (node.content ?? []).some(hasOwnText);
  };
  return !hasOwnText(doc);
}

/** How a new note starts: blank, a built-in template, or one of the student's own sheets. */
export type NoteStart = NoteTemplate | CustomSheet | null;

/** What `createNote` needs for a start: the template value and, for a sheet, its body. */
export function noteStartInput(start: NoteStart): { template: string | null; content?: DocNode } {
  if (start === null || typeof start === 'string') return { template: start };
  return { template: customTemplateValue(start), content: customSheetDoc(start) };
}

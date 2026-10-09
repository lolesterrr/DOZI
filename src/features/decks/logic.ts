import { z } from 'zod';

import type { CardType } from '@/db/schema';
import { mediaRef, parseMediaRef } from '@/features/media/logic';
import { docToText, toNoteDoc, type DocNode } from '@/features/notes/logic';
import {
  emptyOcclusion,
  maskLabels,
  occlusionPicture,
  occlusionProblem,
  occlusionToJson,
  parseOcclusionJson,
  type OcclusionDraft,
  type OcclusionPicture,
  type OcclusionProblem,
} from '@/features/occlusion/logic';

// Pure rules for decks and cards (PRODUCT_SPEC §4.2): deck titles and settings, card fields,
// cloze deletions, checking a card before saving, and which reviewable instances a card makes.
// No React and no database, so all of it is unit-tested.

// ---------------------------------------------------------------------------------------------
// Decks

export const DECK_TITLE_MAX = 80;
export const DECK_DESCRIPTION_MAX = 300;

/** Trims and collapses runs of spaces. */
export function cleanDeckTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

export type DeckTitleProblem = 'empty' | 'tooLong';

export function deckTitleProblem(title: string): DeckTitleProblem | null {
  const cleaned = cleanDeckTitle(title);
  if (!cleaned) return 'empty';
  if (cleaned.length > DECK_TITLE_MAX) return 'tooLong';
  return null;
}

/** Deck settings with their defaults and limits (PRODUCT_SPEC §4.2). */
export const DECK_DEFAULTS = { newPerDay: 15, maxReviewsPerDay: 200, desiredRetention: 0.9 };
export const DECK_LIMITS = {
  newPerDay: { min: 0, max: 500 },
  maxReviewsPerDay: { min: 0, max: 9999 },
  /** As a percentage in the form; stored as 0.70–0.99. */
  retentionPercent: { min: 70, max: 99 },
};

export type DeckSettings = typeof DECK_DEFAULTS;

const wholeNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'notNumber')
    .transform(Number)
    .pipe(z.number().min(min, 'outOfRange').max(max, 'outOfRange'));

/** What the settings form holds: text typed into number fields. Retention is in percent. */
export const deckSettingsFormSchema = z.object({
  newPerDay: wholeNumber(DECK_LIMITS.newPerDay.min, DECK_LIMITS.newPerDay.max),
  maxReviewsPerDay: wholeNumber(DECK_LIMITS.maxReviewsPerDay.min, DECK_LIMITS.maxReviewsPerDay.max),
  retentionPercent: wholeNumber(DECK_LIMITS.retentionPercent.min, DECK_LIMITS.retentionPercent.max),
});

export type DeckSettingsForm = z.input<typeof deckSettingsFormSchema>;
export type DeckSettingsField = keyof DeckSettingsForm;

export function deckSettingsToForm(settings: DeckSettings): DeckSettingsForm {
  return {
    newPerDay: String(settings.newPerDay),
    maxReviewsPerDay: String(settings.maxReviewsPerDay),
    retentionPercent: String(Math.round(settings.desiredRetention * 100)),
  };
}

/** Checks the settings form. Each bad field gets 'notNumber' or 'outOfRange'. */
export function parseDeckSettingsForm(
  form: DeckSettingsForm,
):
  | { ok: true; settings: DeckSettings }
  | { ok: false; errors: Partial<Record<DeckSettingsField, 'notNumber' | 'outOfRange'>> } {
  const result = deckSettingsFormSchema.safeParse(form);
  if (result.success) {
    const { newPerDay, maxReviewsPerDay, retentionPercent } = result.data;
    return {
      ok: true,
      settings: { newPerDay, maxReviewsPerDay, desiredRetention: retentionPercent / 100 },
    };
  }
  const errors: Partial<Record<DeckSettingsField, 'notNumber' | 'outOfRange'>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as DeckSettingsField;
    if (!errors[field]) errors[field] = issue.message === 'outOfRange' ? 'outOfRange' : 'notNumber';
  }
  return { ok: false, errors };
}

// ---------------------------------------------------------------------------------------------
// Card fields
//
// The card editor works with plain text plus images. Each field is saved as ProseMirror JSON —
// one paragraph per line, then the images — like note content, so cards and notes share one
// format and a richer editor can come later without changing saved cards.

/** The card types the card editor makes (every type there is). */
export const editableCardTypes = [
  'basic',
  'basic_reverse',
  'cloze',
  'type_in',
  'image_occlusion',
] as const;
export type EditableCardType = (typeof editableCardTypes)[number];

export function isEditableCardType(type: string): type is EditableCardType {
  return (editableCardTypes as readonly string[]).includes(type);
}

export type CardField = { text: string; mediaIds: string[] };

export const FIELD_TEXT_MAX = 5000;
export const TYPE_IN_ANSWER_MAX = 200;
export const FIELD_IMAGES_MAX = 6;

export function emptyField(): CardField {
  return { text: '', mediaIds: [] };
}

export function isFieldEmpty(field: CardField): boolean {
  return field.text.trim() === '' && field.mediaIds.length === 0;
}

/** A field as ProseMirror JSON: one paragraph per line, then one image node per image. */
export function fieldToDoc(field: CardField): DocNode {
  const lines = field.text.replace(/\r\n?/g, '\n').replace(/\s+$/, '').split('\n');
  const paragraphs: DocNode[] = lines.map((line) =>
    line === ''
      ? { type: 'paragraph' }
      : { type: 'paragraph', content: [{ type: 'text', text: line }] },
  );
  const images: DocNode[] = field.mediaIds.map((id) => ({
    type: 'image',
    attrs: { src: mediaRef(id) },
  }));
  return { type: 'doc', content: [...paragraphs, ...images] };
}

/**
 * Reads a saved field back for the editor: its text (any formatting dropped) and its images.
 * Accepts a JSON string or an already-parsed doc; anything unreadable gives an empty field.
 */
export function docToField(input: string | DocNode | null | undefined): CardField {
  if (input == null) return emptyField();
  let doc: DocNode | null;
  try {
    doc = toNoteDoc(typeof input === 'string' ? JSON.parse(input) : input);
  } catch {
    doc = null;
  }
  if (!doc) return emptyField();
  const mediaIds: string[] = [];
  const walk = (node: DocNode) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      const id = parseMediaRef(node.attrs.src);
      if (id) mediaIds.push(id);
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return { text: docToText(doc).replace(/\s+$/, ''), mediaIds };
}

export type CardDraft = {
  type: EditableCardType;
  /**
   * Basic: front · Cloze: the text with {{c1::…}} · Type-in: the question · Image occlusion: an
   * optional prompt (text only).
   */
  front: CardField;
  /** Basic: back · Cloze: unused · Type-in: the expected answer (text only) · Occlusion: unused. */
  back: CardField;
  /** Shown after the answer (mnemonic, explanation). */
  extra: CardField;
  /** Image occlusion only: the diagram and its boxes. Left out for the other types. */
  occlusion?: OcclusionDraft;
};

export function emptyDraft(type: EditableCardType = 'basic'): CardDraft {
  const draft: CardDraft = { type, front: emptyField(), back: emptyField(), extra: emptyField() };
  if (type === 'image_occlusion') draft.occlusion = emptyOcclusion();
  return draft;
}

/** Starts the next card in bulk-add mode: same type (and hiding mode), empty fields. */
export function nextBulkDraft(previous: CardDraft): CardDraft {
  const next = emptyDraft(previous.type);
  if (next.occlusion && previous.occlusion) next.occlusion.mode = previous.occlusion.mode;
  return next;
}

/** Switches a draft to another type, keeping what was typed (an occlusion gets started). */
export function changeDraftType(draft: CardDraft, type: EditableCardType): CardDraft {
  if (type === 'image_occlusion' && !draft.occlusion) {
    return { ...draft, type, occlusion: emptyOcclusion() };
  }
  return { ...draft, type };
}

/** Every image a draft uses once saved (so images added and then dropped can be cleaned up). */
export function draftMediaIds(draft: CardDraft): string[] {
  const card = tidyDraft(draft);
  const ids = [...card.front.mediaIds, ...card.back.mediaIds, ...card.extra.mediaIds];
  if (card.occlusion?.mediaId) ids.push(card.occlusion.mediaId);
  return ids;
}

export type CardProblem =
  | 'frontEmpty'
  | 'backEmpty'
  | 'noCloze'
  | 'emptyCloze'
  | 'answerEmpty'
  | 'answerTooLong'
  | 'answerOneLine'
  | 'tooLong'
  | 'tooManyImages'
  | OcclusionProblem;

/** Why a card can't be saved yet, or null when it can. */
export function cardDraftProblem(draft: CardDraft): CardProblem | null {
  const fields = [draft.front, draft.back, draft.extra];
  if (fields.some((f) => f.text.length > FIELD_TEXT_MAX)) return 'tooLong';
  if (fields.some((f) => f.mediaIds.length > FIELD_IMAGES_MAX)) return 'tooManyImages';
  switch (draft.type) {
    case 'basic':
    case 'basic_reverse':
      if (isFieldEmpty(draft.front)) return 'frontEmpty';
      if (isFieldEmpty(draft.back)) return 'backEmpty';
      return null;
    case 'cloze': {
      const clozes = parseCloze(draft.front.text).filter((p) => p.type === 'cloze');
      if (clozes.length === 0) return 'noCloze';
      if (clozes.some((c) => c.answer.trim() === '')) return 'emptyCloze';
      return null;
    }
    case 'type_in': {
      if (isFieldEmpty(draft.front)) return 'frontEmpty';
      const answer = draft.back.text.trim();
      if (answer === '') return 'answerEmpty';
      if (answer.includes('\n')) return 'answerOneLine';
      if (answer.length > TYPE_IN_ANSWER_MAX) return 'answerTooLong';
      return null;
    }
    case 'image_occlusion':
      return occlusionProblem(draft.occlusion ?? emptyOcclusion());
  }
}

/**
 * Removes what a card type doesn't use (e.g. the back of a cloze, images in a typed answer, the
 * occlusion of a card switched to another type).
 */
export function tidyDraft(draft: CardDraft): CardDraft {
  if (draft.type === 'image_occlusion') {
    return {
      ...draft,
      front: { text: draft.front.text, mediaIds: [] },
      back: emptyField(),
      occlusion: draft.occlusion ?? emptyOcclusion(),
    };
  }
  const { occlusion: _unused, ...rest } = draft;
  if (draft.type === 'cloze') return { ...rest, back: emptyField() };
  if (draft.type === 'type_in')
    return { ...rest, back: { text: draft.back.text.trim(), mediaIds: [] } };
  return rest;
}

/** What gets saved for a card's faces. */
export function summariseDraft(draft: CardDraft): {
  frontJson: string;
  backJson: string;
  extraJson: string | null;
  frontText: string;
  backText: string;
  occlusionJson: string | null;
} {
  const card = tidyDraft(draft);
  const extraJson = isFieldEmpty(card.extra) ? null : JSON.stringify(fieldToDoc(card.extra));
  if (card.type === 'image_occlusion' && card.occlusion) {
    const labels = maskLabels(card.occlusion).join(' · ');
    // The front keeps the prompt and the diagram itself, so anything that lists a card's images
    // sees this one; the boxes live in occlusion_json.
    const front: CardField = {
      text: card.front.text,
      mediaIds: card.occlusion.mediaId ? [card.occlusion.mediaId] : [],
    };
    return {
      frontJson: JSON.stringify(fieldToDoc(front)),
      backJson: JSON.stringify(fieldToDoc(emptyField())),
      extraJson,
      frontText: card.front.text.trim() || labels,
      backText: labels,
      occlusionJson: card.occlusion.mediaId ? occlusionToJson(card.occlusion) : null,
    };
  }
  return {
    frontJson: JSON.stringify(fieldToDoc(card.front)),
    backJson: JSON.stringify(fieldToDoc(card.back)),
    extraJson,
    frontText: card.type === 'cloze' ? clozePlainText(card.front.text) : card.front.text.trim(),
    backText: card.back.text.trim(),
    occlusionJson: null,
  };
}

/** A saved card back in the editor's shape. Null if an occlusion card's boxes can't be read. */
export function cardToDraft(card: {
  type: CardType;
  frontJson: string;
  backJson: string;
  extraJson: string | null;
  occlusionJson?: string | null;
}): CardDraft | null {
  if (!isEditableCardType(card.type)) return null;
  if (card.type === 'image_occlusion') {
    const occlusion = parseOcclusionJson(card.occlusionJson);
    if (!occlusion) return null;
    return {
      type: card.type,
      // The diagram is in the front's JSON too; the editor keeps it in `occlusion` only.
      front: { text: docToField(card.frontJson).text, mediaIds: [] },
      back: emptyField(),
      extra: docToField(card.extraJson),
      occlusion,
    };
  }
  return {
    type: card.type,
    front: docToField(card.frontJson),
    back: docToField(card.backJson),
    extra: docToField(card.extraJson),
  };
}

// ---------------------------------------------------------------------------------------------
// Cloze deletions: {{c1::answer}} or {{c1::answer::hint}}

export type ClozePart =
  | { type: 'text'; text: string }
  | { type: 'cloze'; number: number; answer: string; hint: string | null };

const CLOZE_PATTERN = /\{\{c(\d{1,3})::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Splits cloze text into plain text and deletions. c0 is not a cloze (Anki numbers from 1). */
export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let last = 0;
  for (const match of text.matchAll(CLOZE_PATTERN)) {
    const number = Number(match[1]);
    if (number < 1) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', text: text.slice(last, start) });
    const hint = match[3]?.trim();
    parts.push({ type: 'cloze', number, answer: match[2], hint: hint ? hint : null });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return mergeText(parts);
}

function mergeText(parts: ClozePart[]): ClozePart[] {
  const merged: ClozePart[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (part.type === 'text' && previous?.type === 'text') previous.text += part.text;
    else merged.push(part);
  }
  return merged;
}

/** The cloze numbers used, smallest first, without repeats. */
export function clozeNumbers(text: string): number[] {
  const numbers = new Set<number>();
  for (const part of parseCloze(text)) if (part.type === 'cloze') numbers.add(part.number);
  return [...numbers].sort((a, b) => a - b);
}

/** The number the cloze button uses next: one more than the biggest so far. */
export function nextClozeNumber(text: string): number {
  const numbers = clozeNumbers(text);
  return numbers.length === 0 ? 1 : numbers[numbers.length - 1] + 1;
}

/** The cloze number just before the cursor, for "same number" (or 1 if there is none). */
export function lastClozeNumber(text: string): number {
  const numbers = clozeNumbers(text);
  return numbers.length === 0 ? 1 : numbers[numbers.length - 1];
}

export type TextSelection = { start: number; end: number };

/**
 * Wraps the selected text in `{{cN::…}}`. With nothing selected it inserts an empty
 * `{{cN::}}` and puts the cursor inside it, ready to type the answer.
 */
export function wrapCloze(
  text: string,
  selection: TextSelection,
  number: number,
): { text: string; selection: TextSelection } {
  const start = Math.max(0, Math.min(selection.start, selection.end, text.length));
  const end = Math.min(text.length, Math.max(selection.start, selection.end));
  const open = `{{c${number}::`;
  const selected = text.slice(start, end);
  const wrapped = `${open}${selected}}}`;
  const next = text.slice(0, start) + wrapped + text.slice(end);
  const cursor = selected === '' ? start + open.length : start + wrapped.length;
  return { text: next, selection: { start: cursor, end: cursor } };
}

/** The cloze text with the markers removed and the answers kept (previews, search). */
export function clozePlainText(text: string): string {
  return parseCloze(text)
    .map((part) => (part.type === 'text' ? part.text : part.answer))
    .join('')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Card instances: what a card gives to review

/**
 * The `sub_key`s a card should have: one per reviewable instance. `clozeText` is the cloze
 * field as typed (with its {{c1::…}} markers), not the stored plain `front_text`; `maskIds` are
 * an occlusion card's boxes.
 */
export function instanceKeys(
  type: CardType,
  clozeText: string,
  maskIds: readonly string[] = [],
): string[] {
  switch (type) {
    case 'basic':
    case 'type_in':
      return ['front'];
    case 'basic_reverse':
      return ['front', 'reverse'];
    case 'cloze':
      return clozeNumbers(clozeText).map((n) => `c${n}`);
    case 'image_occlusion':
      return [...maskIds];
  }
}

/** The `sub_key`s a draft makes: one per cloze number, direction or occlusion box. */
export function draftInstanceKeys(draft: CardDraft): string[] {
  return instanceKeys(
    draft.type,
    draft.front.text,
    draft.occlusion?.masks.map((m) => m.id),
  );
}

type ExistingInstance = { id: string; subKey: string; deletedAt: string | null };

export type InstancePlan = {
  /** Keys that need a new row. */
  create: string[];
  /** Soft-deleted rows to bring back (their review history comes back with them). */
  revive: string[];
  /** Rows to soft-delete: keys the card no longer has, and duplicates of a key. */
  remove: string[];
};

/**
 * Compares a card's instance rows with the keys it should have. Rows are reused by key, so
 * editing the text of c1 keeps c1's review history, and removing then re-adding c2 revives it.
 */
export function planInstances(
  existing: readonly ExistingInstance[],
  wanted: readonly string[],
): InstancePlan {
  const plan: InstancePlan = { create: [], revive: [], remove: [] };
  const wantedSet = new Set(wanted);
  const kept = new Set<string>();
  // Live rows first, so a live row is kept in preference to a deleted one with the same key.
  const ordered = [...existing].sort(
    (a, b) =>
      Number(a.deletedAt !== null) - Number(b.deletedAt !== null) || a.id.localeCompare(b.id),
  );
  for (const row of ordered) {
    if (wantedSet.has(row.subKey) && !kept.has(row.subKey)) {
      kept.add(row.subKey);
      if (row.deletedAt !== null) plan.revive.push(row.id);
    } else if (row.deletedAt === null) {
      plan.remove.push(row.id);
    }
  }
  for (const key of wanted) {
    if (kept.has(key)) continue;
    kept.add(key);
    plan.create.push(key);
  }
  return plan;
}

// ---------------------------------------------------------------------------------------------
// Showing a card instance (preview here, review screen in task 1.8)

export type FaceSpan = {
  text: string;
  /** 'hidden': a cloze being asked ([…] or its hint) · 'answer': a cloze being revealed. */
  style: 'plain' | 'hidden' | 'answer';
};

export type FaceBlock =
  | { kind: 'text'; spans: FaceSpan[] }
  | { kind: 'image'; mediaId: string }
  /** An occlusion diagram with its boxes covered or revealed. */
  | { kind: 'occlusion'; picture: OcclusionPicture };

export type Face = FaceBlock[];

export type InstanceFaces = {
  /** What the question side shows. */
  front: Face;
  /** What the answer side adds. For cloze this is the whole text with the answer revealed. */
  back: Face;
  extra: Face;
};

/** The placeholder for a hidden cloze with no hint. */
export const CLOZE_BLANK = '[…]';

function plainFace(field: CardField): Face {
  const blocks: Face = [];
  const text = field.text.replace(/\s+$/, '');
  if (text)
    for (const line of text.split('\n'))
      blocks.push({ kind: 'text', spans: [{ text: line, style: 'plain' }] });
  for (const mediaId of field.mediaIds) blocks.push({ kind: 'image', mediaId });
  return blocks;
}

function clozeFace(field: CardField, number: number, reveal: boolean): Face {
  const spans: FaceSpan[] = parseCloze(field.text.replace(/\s+$/, '')).map((part) => {
    if (part.type === 'text') return { text: part.text, style: 'plain' };
    if (part.number !== number) return { text: part.answer, style: 'plain' };
    if (reveal) return { text: part.answer, style: 'answer' };
    return { text: part.hint ? `[${part.hint}]` : CLOZE_BLANK, style: 'hidden' };
  });
  // Split into lines so each paragraph is its own block, like the other card types.
  const blocks: Face = [];
  let line: FaceSpan[] = [];
  for (const span of spans) {
    const pieces = span.text.split('\n');
    pieces.forEach((piece, i) => {
      if (i > 0) {
        blocks.push({ kind: 'text', spans: line });
        line = [];
      }
      if (piece !== '') line.push({ text: piece, style: span.style });
    });
  }
  blocks.push({ kind: 'text', spans: line });
  const textBlocks = blocks.filter((b) => b.kind === 'text' && b.spans.length > 0);
  return [
    ...textBlocks,
    ...field.mediaIds.map((mediaId): FaceBlock => ({ kind: 'image', mediaId })),
  ];
}

/** The two sides of one instance of a card (`subKey` from `instanceKeys`). */
export function instanceFaces(draft: CardDraft, subKey: string): InstanceFaces {
  const extra = plainFace(draft.extra);
  switch (draft.type) {
    case 'basic':
    case 'type_in':
      return { front: plainFace(draft.front), back: plainFace(draft.back), extra };
    case 'basic_reverse':
      return subKey === 'reverse'
        ? { front: plainFace(draft.back), back: plainFace(draft.front), extra }
        : { front: plainFace(draft.front), back: plainFace(draft.back), extra };
    case 'cloze': {
      const number = Number(subKey.replace(/^c/, '')) || 1;
      return {
        front: clozeFace(draft.front, number, false),
        back: clozeFace(draft.front, number, true),
        extra,
      };
    }
    case 'image_occlusion':
      return occlusionFaces(draft, subKey, extra);
  }
}

/**
 * An occlusion card: the prompt (if any) over the diagram. Like a cloze, its answer side is the
 * whole picture again, with the asked box uncovered and outlined and its label (if any) below.
 */
function occlusionFaces(draft: CardDraft, maskId: string, extra: Face): InstanceFaces {
  const occlusion = draft.occlusion ?? emptyOcclusion();
  const prompt = plainFace({ text: draft.front.text, mediaIds: [] });
  const question = occlusionPicture(occlusion, maskId, false);
  const answer = occlusionPicture(occlusion, maskId, true);
  const label = occlusion.masks.find((m) => m.id === maskId)?.label.trim() ?? '';
  const front: Face = question ? [...prompt, { kind: 'occlusion', picture: question }] : prompt;
  const back: Face = answer ? [...prompt, { kind: 'occlusion', picture: answer }] : [...prompt];
  if (label) back.push({ kind: 'text', spans: [{ text: label, style: 'answer' }] });
  return { front, back, extra };
}

/** Every instance a draft would make, in order — what the preview shows. */
export function draftInstances(draft: CardDraft): { subKey: string; faces: InstanceFaces }[] {
  const card = tidyDraft(draft);
  return draftInstanceKeys(card).map((subKey) => ({
    subKey,
    faces: instanceFaces(card, subKey),
  }));
}

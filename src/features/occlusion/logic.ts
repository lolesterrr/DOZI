import { z } from 'zod';

// Pure rules for image occlusion cards (PRODUCT_SPEC §4.2): boxes ("masks") drawn over the labels
// of a diagram, the two hiding modes, the editor's drag gestures and what each card shows.
// No React and no database, so all of it is unit-tested.
//
// Every mask is stored in fractions of the image (0–1 across and down), so it lands on the same
// spot at any screen size, and still fits when the image is swapped for an annotated copy.

export const occlusionModes = ['hide_one', 'hide_all'] as const;
/** hide_one: hide the asked box, show the others · hide_all: hide every box, reveal the asked one. */
export type OcclusionMode = (typeof occlusionModes)[number];

export const MAX_MASKS = 40;
export const MASK_LABEL_MAX = 60;
/** Smallest box side, as a fraction of the image (smaller drags count as taps). */
export const MIN_MASK_SIZE = 0.02;

export type Mask = {
  /** Also the card instance's `sub_key`: m001, m002… */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** What is under the box (optional); shown with the answer. */
  label: string;
};

export type OcclusionDraft = {
  /** The diagram, or null before one is picked. */
  mediaId: string | null;
  /** The image's size in pixels (for its shape on screen). */
  width: number;
  height: number;
  mode: OcclusionMode;
  masks: Mask[];
  /** The number the next box gets. Never goes down, so a deleted box's id is never reused. */
  nextMask: number;
};

export function emptyOcclusion(mode: OcclusionMode = 'hide_one'): OcclusionDraft {
  return { mediaId: null, width: 0, height: 0, mode, masks: [], nextMask: 1 };
}

export function maskId(number: number): string {
  return `m${String(number).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Saving and loading: cards.occlusion_json

const fraction = z.number().finite().min(0).max(1);

const maskSchema = z.object({
  id: z.string().min(1).max(40),
  x: fraction,
  y: fraction,
  w: fraction,
  h: fraction,
  label: z.string().max(MASK_LABEL_MAX).default(''),
});

/** What is stored in `cards.occlusion_json` (ARCHITECTURE §3.3). */
export const occlusionJsonSchema = z.object({
  version: z.literal(1),
  media_id: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mode: z.enum(occlusionModes),
  masks: z.array(maskSchema).max(MAX_MASKS),
  next_mask: z.number().int().positive(),
});

export function occlusionToJson(draft: OcclusionDraft): string {
  if (!draft.mediaId) throw new Error('An occlusion card needs an image');
  return JSON.stringify({
    version: 1,
    media_id: draft.mediaId,
    width: draft.width,
    height: draft.height,
    mode: draft.mode,
    masks: draft.masks.map(({ id, x, y, w, h, label }) => ({ id, x, y, w, h, label })),
    next_mask: draft.nextMask,
  });
}

/** Reads `occlusion_json` back. Null if it is missing or doesn't match the schema. */
export function parseOcclusionJson(json: string | null | undefined): OcclusionDraft | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const result = occlusionJsonSchema.safeParse(raw);
  if (!result.success) return null;
  const data = result.data;
  const highest = Math.max(0, ...data.masks.map((m) => Number(/^m(\d+)$/.exec(m.id)?.[1] ?? 0)));
  return {
    mediaId: data.media_id,
    width: data.width,
    height: data.height,
    mode: data.mode,
    masks: data.masks,
    nextMask: Math.max(data.next_mask, highest + 1),
  };
}

export type OcclusionProblem = 'noImage' | 'noMasks' | 'tooManyMasks';

export function occlusionProblem(draft: OcclusionDraft): OcclusionProblem | null {
  if (!draft.mediaId || draft.width <= 0 || draft.height <= 0) return 'noImage';
  if (draft.masks.length === 0) return 'noMasks';
  if (draft.masks.length > MAX_MASKS) return 'tooManyMasks';
  return null;
}

/** The labels typed so far, in box order (for previews and search). */
export function maskLabels(draft: OcclusionDraft): string[] {
  return draft.masks.map((m) => m.label.trim()).filter((label) => label !== '');
}

export function cleanLabel(label: string): string {
  return label.replace(/\s+/g, ' ').trimStart().slice(0, MASK_LABEL_MAX);
}

// ---------------------------------------------------------------------------------------------
// What a card shows

export type MaskLook =
  /** The box being asked: covered, with a "?" on it. */
  | 'asked'
  /** Another box, covered (hide-all mode). */
  | 'covered'
  /** The asked box after "Show answer": uncovered, with a thick outline. */
  | 'revealed'
  /** Every box in the editor's preview, numbered. */
  | 'numbered';

export type OcclusionBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  look: MaskLook;
  /** Shown on 'numbered' boxes. */
  number: number;
};

export type OcclusionPicture = {
  mediaId: string;
  width: number;
  height: number;
  boxes: OcclusionBox[];
  /** Which box is asked (1-based) and how many there are, for screen readers. */
  asked: number;
  total: number;
  revealed: boolean;
};

/**
 * The picture for one card (one mask) on its question side or answer side. In hide-one mode only
 * the asked box is covered, so the other labels stay readable as hints; in hide-all mode every
 * other box stays covered on both sides.
 */
export function occlusionPicture(
  draft: OcclusionDraft,
  askedId: string,
  reveal: boolean,
): OcclusionPicture | null {
  if (!draft.mediaId) return null;
  const index = draft.masks.findIndex((m) => m.id === askedId);
  const boxes: OcclusionBox[] = [];
  draft.masks.forEach((mask, i) => {
    const { x, y, w, h } = mask;
    if (mask.id === askedId)
      boxes.push({ x, y, w, h, look: reveal ? 'revealed' : 'asked', number: i + 1 });
    else if (draft.mode === 'hide_all') boxes.push({ x, y, w, h, look: 'covered', number: i + 1 });
  });
  return {
    mediaId: draft.mediaId,
    width: draft.width,
    height: draft.height,
    boxes,
    asked: index + 1,
    total: draft.masks.length,
    revealed: reveal,
  };
}

/** Every box numbered, for the card editor. */
export function numberedPicture(draft: OcclusionDraft): OcclusionPicture | null {
  if (!draft.mediaId) return null;
  return {
    mediaId: draft.mediaId,
    width: draft.width,
    height: draft.height,
    boxes: draft.masks.map(({ x, y, w, h }, i) => ({
      x,
      y,
      w,
      h,
      look: 'numbered',
      number: i + 1,
    })),
    asked: 0,
    total: draft.masks.length,
    revealed: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Geometry (all in image fractions)

export type Point = { x: number; y: number };
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The box between two corners, whichever way the finger dragged, kept on the image. */
export function boxBetween(a: Point, b: Point) {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  const x2 = clamp01(Math.max(a.x, b.x));
  const y2 = clamp01(Math.max(a.y, b.y));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Moves a box by (dx, dy), stopping at the image's edges. */
export function moveMask(mask: Mask, dx: number, dy: number): Mask {
  return {
    ...mask,
    x: Math.min(Math.max(mask.x + dx, 0), 1 - mask.w),
    y: Math.min(Math.max(mask.y + dy, 0), 1 - mask.h),
  };
}

/**
 * Drags one corner of a box to `to`; the opposite corner stays put. The box never gets smaller
 * than `minSize` or turns inside out.
 */
export function resizeMask(mask: Mask, corner: Corner, to: Point, minSize = MIN_MASK_SIZE): Mask {
  let left = mask.x;
  let top = mask.y;
  let right = mask.x + mask.w;
  let bottom = mask.y + mask.h;
  const px = clamp01(to.x);
  const py = clamp01(to.y);
  if (corner === 'tl' || corner === 'bl') left = Math.min(px, right - minSize);
  else right = Math.max(px, left + minSize);
  if (corner === 'tl' || corner === 'tr') top = Math.min(py, bottom - minSize);
  else bottom = Math.max(py, top + minSize);
  left = clamp01(left);
  top = clamp01(top);
  right = clamp01(right);
  bottom = clamp01(bottom);
  return { ...mask, x: left, y: top, w: right - left, h: bottom - top };
}

/** How far a touch may land from a corner and still grab it, in image fractions. */
export type Reach = { x: number; y: number };

export type Hit = { id: string; part: 'body' | Corner };

function corners(mask: Mask): Record<Corner, Point> {
  return {
    tl: { x: mask.x, y: mask.y },
    tr: { x: mask.x + mask.w, y: mask.y },
    bl: { x: mask.x, y: mask.y + mask.h },
    br: { x: mask.x + mask.w, y: mask.y + mask.h },
  };
}

/**
 * What a touch lands on: a corner handle of the selected box first (handles stick out past the
 * box), then the topmost box under the finger. Null on empty image.
 */
export function hitTest(
  masks: readonly Mask[],
  at: Point,
  reach: Reach,
  selectedId: string | null,
): Hit | null {
  const selected = masks.find((m) => m.id === selectedId);
  if (selected) {
    const handles = corners(selected);
    let best: { corner: Corner; distance: number } | null = null;
    for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
      const dx = Math.abs(at.x - handles[corner].x) / reach.x;
      const dy = Math.abs(at.y - handles[corner].y) / reach.y;
      if (dx <= 1 && dy <= 1) {
        const distance = Math.hypot(dx, dy);
        if (!best || distance < best.distance) best = { corner, distance };
      }
    }
    if (best) return { id: selected.id, part: best.corner };
  }
  for (let i = masks.length - 1; i >= 0; i--) {
    const m = masks[i]!;
    if (at.x >= m.x && at.x <= m.x + m.w && at.y >= m.y && at.y <= m.y + m.h) {
      return { id: m.id, part: 'body' };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The box editor's state: the boxes, which one is selected, and the drag in progress

export type MaskDrag =
  | { kind: 'draw'; from: Point; to: Point }
  | { kind: 'move'; id: string; from: Point; to: Point; original: Mask }
  | { kind: 'resize'; id: string; corner: Corner; original: Mask };

export type MaskEditorState = {
  masks: Mask[];
  nextMask: number;
  selectedId: string | null;
  drag: MaskDrag | null;
  /** Set when a box couldn't be added because there are already MAX_MASKS. */
  full: boolean;
};

export type MaskEditorAction =
  /** Finger down. `reach` is the handle size in image fractions. */
  | { type: 'press'; at: Point; reach: Reach }
  | { type: 'drag'; to: Point }
  /** Finger up. A tiny "draw" is a tap on empty image: it clears the selection. */
  | { type: 'release' }
  | { type: 'cancel' }
  | { type: 'select'; id: string | null }
  | { type: 'delete'; id: string }
  | { type: 'label'; id: string; label: string };

export function startMaskEditor(
  draft: Pick<OcclusionDraft, 'masks' | 'nextMask'>,
): MaskEditorState {
  return {
    masks: draft.masks,
    nextMask: draft.nextMask,
    selectedId: null,
    drag: null,
    full: false,
  };
}

/** The masks as they look right now, including the one being drawn, moved or resized. */
export function liveMasks(state: MaskEditorState): Mask[] {
  const { drag } = state;
  if (!drag) return state.masks;
  if (drag.kind === 'draw') {
    return [...state.masks, { id: 'drawing', label: '', ...boxBetween(drag.from, drag.to) }];
  }
  return state.masks.map((m) => (m.id === drag.id ? draggedMask(drag) : m));
}

function draggedMask(drag: Exclude<MaskDrag, { kind: 'draw' }>): Mask {
  if (drag.kind === 'move') {
    return moveMask(drag.original, drag.to.x - drag.from.x, drag.to.y - drag.from.y);
  }
  return drag.original;
}

export function maskEditorReducer(
  state: MaskEditorState,
  action: MaskEditorAction,
): MaskEditorState {
  switch (action.type) {
    case 'press': {
      const hit = hitTest(state.masks, action.at, action.reach, state.selectedId);
      if (!hit) {
        return { ...state, full: false, drag: { kind: 'draw', from: action.at, to: action.at } };
      }
      const original = state.masks.find((m) => m.id === hit.id)!;
      if (hit.part === 'body') {
        return {
          ...state,
          full: false,
          selectedId: hit.id,
          drag: { kind: 'move', id: hit.id, from: action.at, to: action.at, original },
        };
      }
      return {
        ...state,
        full: false,
        selectedId: hit.id,
        drag: { kind: 'resize', id: hit.id, corner: hit.part, original },
      };
    }
    case 'drag': {
      const { drag } = state;
      if (!drag) return state;
      if (drag.kind === 'resize') {
        const resized = resizeMask(drag.original, drag.corner, action.to);
        return {
          ...state,
          masks: state.masks.map((m) => (m.id === drag.id ? resized : m)),
        };
      }
      return { ...state, drag: { ...drag, to: action.to } };
    }
    case 'release': {
      const { drag } = state;
      if (!drag) return state;
      if (drag.kind === 'resize') return { ...state, drag: null };
      if (drag.kind === 'move') {
        return {
          ...state,
          drag: null,
          masks: state.masks.map((m) => (m.id === drag.id ? draggedMask(drag) : m)),
        };
      }
      const box = boxBetween(drag.from, drag.to);
      if (box.w < MIN_MASK_SIZE || box.h < MIN_MASK_SIZE) {
        // A tap on empty image.
        return { ...state, drag: null, selectedId: null };
      }
      if (state.masks.length >= MAX_MASKS) return { ...state, drag: null, full: true };
      const id = maskId(state.nextMask);
      return {
        ...state,
        drag: null,
        masks: [...state.masks, { id, label: '', ...box }],
        nextMask: state.nextMask + 1,
        selectedId: id,
      };
    }
    case 'cancel':
      return state.drag ? { ...state, drag: null } : state;
    case 'select':
      return { ...state, selectedId: action.id, full: false };
    case 'delete':
      return {
        ...state,
        masks: state.masks.filter((m) => m.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        full: false,
      };
    case 'label':
      return {
        ...state,
        masks: state.masks.map((m) =>
          m.id === action.id ? { ...m, label: cleanLabel(action.label) } : m,
        ),
      };
  }
}

/** Labels lose their trailing spaces when the editor closes. */
export function finishMasks(masks: readonly Mask[]): Mask[] {
  return masks.map((m) => ({ ...m, label: m.label.trim() }));
}

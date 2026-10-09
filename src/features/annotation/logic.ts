import { z } from 'zod';

import { annotationColourNames, type AnnotationColourName } from '@/theme/tokens';

// Pure rules for drawing on images (PRODUCT_SPEC §4.1, ARCHITECTURE §5 step 6). No Skia or device
// APIs here, so everything is unit-tested. Every coordinate is in the base image's own pixels,
// so a drawing looks the same on any screen size and when it is burnt into the saved JPEG.

export const annotationTools = ['arrow', 'box', 'circle', 'freehand', 'text'] as const;
export type AnnotationTool = (typeof annotationTools)[number];

export type Point = { x: number; y: number };

const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
const colourSchema = z.enum(annotationColourNames);

/** Longest text label, in characters. */
export const MAX_TEXT_LENGTH = 60;
/** Undo steps kept while drawing. */
export const MAX_HISTORY = 100;

const shapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('arrow'), colour: colourSchema, from: pointSchema, to: pointSchema }),
  z.object({ kind: z.literal('box'), colour: colourSchema, from: pointSchema, to: pointSchema }),
  z.object({ kind: z.literal('circle'), colour: colourSchema, from: pointSchema, to: pointSchema }),
  z.object({
    kind: z.literal('freehand'),
    colour: colourSchema,
    points: z.array(pointSchema).min(1),
  }),
  z.object({
    kind: z.literal('text'),
    colour: colourSchema,
    at: pointSchema,
    text: z.string().min(1).max(MAX_TEXT_LENGTH),
  }),
]);

export type Shape = z.infer<typeof shapeSchema>;
export type DragShape = Extract<Shape, { kind: 'arrow' | 'box' | 'circle' }>;

/** What `media.annotation_json` holds: the drawing, separate from the image it was drawn on. */
export const annotationSchema = z.object({
  version: z.literal(1),
  /** Size of the base (original) image the coordinates refer to. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  shapes: z.array(shapeSchema),
});

export type Annotation = z.infer<typeof annotationSchema>;

export function emptyAnnotation(width: number, height: number): Annotation {
  return { version: 1, width, height, shapes: [] };
}

export function serializeAnnotation(annotation: Annotation): string {
  return JSON.stringify(annotationSchema.parse(annotation));
}

/** Reads `media.annotation_json`. Returns null when it is missing or not a drawing we know. */
export function parseAnnotation(json: string | null | undefined): Annotation | null {
  if (!json) return null;
  try {
    const result = annotationSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Sizes: pen width and text size grow with the image so they look the same on small and big photos

export type Size = { width: number; height: number };

export function strokeWidthFor({ width, height }: Size): number {
  return Math.max(2, Math.round(Math.max(width, height) * 0.006));
}

export function textSizeFor({ width, height }: Size): number {
  return Math.max(14, Math.round(Math.max(width, height) * 0.045));
}

/** Drags shorter than this (in image pixels) are treated as accidental taps and dropped. */
export function minDragFor({ width, height }: Size): number {
  return Math.max(4, Math.round(Math.max(width, height) * 0.01));
}

// ---------------------------------------------------------------------------------------------
// Fitting the image on screen

export type Fit = { scale: number; offsetX: number; offsetY: number };

/** Where an image sits when it is shown whole ("contain") and centred in a view. */
export function fitImage(image: Size, view: Size): Fit {
  if (image.width <= 0 || image.height <= 0 || view.width <= 0 || view.height <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(view.width / image.width, view.height / image.height);
  return {
    scale,
    offsetX: (view.width - image.width * scale) / 2,
    offsetY: (view.height - image.height * scale) / 2,
  };
}

/** A touch point on screen → a point on the image, kept inside the image. */
export function toImagePoint(view: Point, fit: Fit, image: Size): Point {
  const x = (view.x - fit.offsetX) / fit.scale;
  const y = (view.y - fit.offsetY) / fit.scale;
  return { x: clamp(x, 0, image.width), y: clamp(y, 0, image.height) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------------------------
// Building shapes from a drag

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Starts a shape where the finger first touches. Text is placed with a tap instead. */
export function startShape(
  tool: Exclude<AnnotationTool, 'text'>,
  colour: AnnotationColourName,
  at: Point,
): Shape {
  if (tool === 'freehand') return { kind: 'freehand', colour, points: [at] };
  return { kind: tool, colour, from: at, to: at };
}

/**
 * Moves the end of a shape that is being drawn. Freehand lines only gain a point once the finger
 * has moved `minStep` pixels, which keeps long scribbles light on slow phones.
 */
export function extendShape(shape: Shape, to: Point, minStep: number): Shape {
  switch (shape.kind) {
    case 'freehand': {
      const last = shape.points[shape.points.length - 1];
      if (last && distance(last, to) < minStep) return shape;
      return { ...shape, points: [...shape.points, to] };
    }
    case 'text':
      return shape;
    default:
      return { ...shape, to };
  }
}

/** False for a drag so short it was probably a tap (a freehand tap still makes a dot). */
export function isWorthKeeping(shape: Shape, minDrag: number): boolean {
  switch (shape.kind) {
    case 'freehand':
      return shape.points.length > 0;
    case 'text':
      return shape.text.trim().length > 0;
    case 'arrow':
      return distance(shape.from, shape.to) >= minDrag;
    default:
      return (
        Math.abs(shape.to.x - shape.from.x) >= minDrag &&
        Math.abs(shape.to.y - shape.from.y) >= minDrag
      );
  }
}

/** A text label, trimmed and cut to the maximum length. Null if nothing is left. */
export function makeTextShape(colour: AnnotationColourName, at: Point, text: string): Shape | null {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH).trim();
  return clean ? { kind: 'text', colour, at, text: clean } : null;
}

// ---------------------------------------------------------------------------------------------
// Geometry the renderer draws

export type Rect = { x: number; y: number; width: number; height: number };

/** The rectangle between two corners, whichever way the finger dragged. */
export function rectBetween(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

const round = (value: number) => Math.round(value * 10) / 10;
const pt = (p: Point) => `${round(p.x)} ${round(p.y)}`;

/**
 * An arrow as two SVG paths: the shaft (a stroked line) and a filled triangular head at `to`.
 * The shaft stops inside the head so the tip stays sharp with a thick pen.
 */
export function arrowPaths(from: Point, to: Point, strokeWidth: number) {
  const length = distance(from, to);
  const headLength = Math.min(Math.max(strokeWidth * 4, 12), Math.max(length * 0.6, 1));
  const headHalfWidth = headLength * 0.55;
  if (length === 0) return { shaft: `M ${pt(from)} L ${pt(to)}`, head: `M ${pt(to)} Z` };
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const base = { x: to.x - ux * headLength, y: to.y - uy * headLength };
  const left = { x: base.x - uy * headHalfWidth, y: base.y + ux * headHalfWidth };
  const right = { x: base.x + uy * headHalfWidth, y: base.y - ux * headHalfWidth };
  const shaftEnd = { x: to.x - ux * headLength * 0.5, y: to.y - uy * headLength * 0.5 };
  return {
    shaft: `M ${pt(from)} L ${pt(shaftEnd)}`,
    head: `M ${pt(to)} L ${pt(left)} L ${pt(right)} Z`,
  };
}

/**
 * A smooth SVG path through freehand points: quadratic curves through the midpoints, so the
 * line follows the finger without corners. One point becomes a dot (round caps draw it).
 */
export function freehandPath(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${pt(first)} L ${pt(first)}`;
  if (points.length === 2) return `M ${pt(first)} L ${pt(points[1]!)}`;
  let d = `M ${pt(first)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const next = points[i + 1]!;
    d += ` Q ${pt(p)} ${pt({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`;
  }
  return `${d} L ${pt(points[points.length - 1]!)}`;
}

// ---------------------------------------------------------------------------------------------
// Undo / redo

export type History = { past: Shape[][]; present: Shape[]; future: Shape[][] };

export function startHistory(shapes: Shape[] = []): History {
  return { past: [], present: shapes, future: [] };
}

/** Adds a finished shape. Clears redo, like any editor. */
export function addShape(history: History, shape: Shape): History {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return { past, present: [...history.present, shape], future: [] };
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export const canUndo = (history: History) => history.past.length > 0;
export const canRedo = (history: History) => history.future.length > 0;

/** True when the drawing differs from what was there when the screen opened. */
export function hasChanges(history: History, initial: readonly Shape[]): boolean {
  return JSON.stringify(history.present) !== JSON.stringify(initial);
}

/**
 * Where to start drawing a text label so it is centred on the point the student tapped
 * (Skia draws text from the left end of its baseline). Kept inside the image where possible.
 */
export function textOrigin(at: Point, textWidth: number, textSize: number, image: Size): Point {
  const x = clamp(at.x - textWidth / 2, 0, Math.max(0, image.width - textWidth));
  const y = clamp(at.y + textSize * 0.35, textSize, image.height);
  return { x, y };
}

// ---------------------------------------------------------------------------------------------
// The drawing screen's state: the finished shapes (with undo/redo) and the shape being drawn

export type DrawingState = { history: History; draft: Shape | null };

export type DrawingAction =
  /** Finger down with a drag tool. */
  | {
      type: 'start';
      tool: Exclude<AnnotationTool, 'text'>;
      colour: AnnotationColourName;
      at: Point;
    }
  /** Finger moved; `minStep` thins freehand points. */
  | { type: 'move'; to: Point; minStep: number }
  /** Finger up: keep the shape unless it was too small. */
  | { type: 'end'; minDrag: number }
  /** The gesture was cancelled (e.g. a second finger). */
  | { type: 'cancel' }
  | { type: 'addText'; colour: AnnotationColourName; at: Point; text: string }
  | { type: 'undo' }
  | { type: 'redo' };

export function startDrawing(shapes: Shape[] = []): DrawingState {
  return { history: startHistory(shapes), draft: null };
}

export function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'start':
      return { ...state, draft: startShape(action.tool, action.colour, action.at) };
    case 'move':
      return state.draft
        ? { ...state, draft: extendShape(state.draft, action.to, action.minStep) }
        : state;
    case 'end': {
      const { draft } = state;
      if (!draft) return state;
      const keep = isWorthKeeping(draft, action.minDrag);
      return { history: keep ? addShape(state.history, draft) : state.history, draft: null };
    }
    case 'cancel':
      return state.draft ? { ...state, draft: null } : state;
    case 'addText': {
      const shape = makeTextShape(action.colour, action.at, action.text);
      return shape ? { history: addShape(state.history, shape), draft: null } : state;
    }
    case 'undo':
      return { history: undo(state.history), draft: null };
    case 'redo':
      return { history: redo(state.history), draft: null };
  }
}

/** Everything to draw right now: the finished shapes plus the one under the finger. */
export function visibleShapes(state: DrawingState): Shape[] {
  return state.draft ? [...state.history.present, state.draft] : state.history.present;
}

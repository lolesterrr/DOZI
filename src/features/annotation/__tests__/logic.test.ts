import {
  addShape,
  annotationSchema,
  arrowPaths,
  canRedo,
  canUndo,
  drawingReducer,
  emptyAnnotation,
  extendShape,
  fitImage,
  freehandPath,
  hasChanges,
  isWorthKeeping,
  makeTextShape,
  MAX_HISTORY,
  MAX_TEXT_LENGTH,
  minDragFor,
  parseAnnotation,
  rectBetween,
  redo,
  serializeAnnotation,
  startDrawing,
  startHistory,
  startShape,
  strokeWidthFor,
  textOrigin,
  textSizeFor,
  toImagePoint,
  undo,
  visibleShapes,
  type Annotation,
  type Shape,
} from '../logic';

const box: Shape = { kind: 'box', colour: 'red', from: { x: 10, y: 10 }, to: { x: 60, y: 40 } };
const label: Shape = { kind: 'text', colour: 'yellow', at: { x: 5, y: 5 }, text: 'SAMPLE' };

describe('annotation JSON', () => {
  const annotation: Annotation = {
    version: 1,
    width: 1600,
    height: 1200,
    shapes: [
      box,
      label,
      { kind: 'arrow', colour: 'blue', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
      { kind: 'circle', colour: 'green', from: { x: 1, y: 2 }, to: { x: 3, y: 4 } },
      { kind: 'freehand', colour: 'black', points: [{ x: 1, y: 1 }] },
    ],
  };

  it('round-trips every shape type', () => {
    expect(parseAnnotation(serializeAnnotation(annotation))).toEqual(annotation);
  });

  it('returns null for missing, broken or unknown drawings', () => {
    expect(parseAnnotation(null)).toBeNull();
    expect(parseAnnotation('')).toBeNull();
    expect(parseAnnotation('{not json')).toBeNull();
    expect(parseAnnotation(JSON.stringify({ ...annotation, version: 2 }))).toBeNull();
    expect(
      parseAnnotation(JSON.stringify({ ...annotation, shapes: [{ ...box, colour: 'pink' }] })),
    ).toBeNull();
  });

  it('refuses to save an invalid drawing', () => {
    expect(() => serializeAnnotation({ ...annotation, width: 0 })).toThrow();
    expect(annotationSchema.safeParse(emptyAnnotation(10, 20)).success).toBe(true);
  });
});

describe('sizes', () => {
  it('scales pen and text with the image, with a sensible minimum', () => {
    expect(strokeWidthFor({ width: 1600, height: 1200 })).toBe(10);
    expect(strokeWidthFor({ width: 100, height: 50 })).toBe(2);
    expect(textSizeFor({ width: 1600, height: 900 })).toBe(72);
    expect(textSizeFor({ width: 100, height: 100 })).toBe(14);
    expect(minDragFor({ width: 1600, height: 1200 })).toBe(16);
  });
});

describe('fitting the image on screen', () => {
  it('centres a wide image in a tall view', () => {
    const fit = fitImage({ width: 1600, height: 800 }, { width: 400, height: 600 });
    expect(fit).toEqual({ scale: 0.25, offsetX: 0, offsetY: 200 });
    expect(toImagePoint({ x: 200, y: 300 }, fit, { width: 1600, height: 800 })).toEqual({
      x: 800,
      y: 400,
    });
  });

  it('keeps touches outside the picture on its edge', () => {
    const image = { width: 1600, height: 800 };
    const fit = fitImage(image, { width: 400, height: 600 });
    expect(toImagePoint({ x: -20, y: 10 }, fit, image)).toEqual({ x: 0, y: 0 });
    expect(toImagePoint({ x: 500, y: 590 }, fit, image)).toEqual({ x: 1600, y: 800 });
  });

  it('copes with a view that has not been measured yet', () => {
    expect(fitImage({ width: 10, height: 10 }, { width: 0, height: 0 })).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe('drawing shapes', () => {
  it('starts drag shapes at the touch point and moves their end', () => {
    const arrow = startShape('arrow', 'red', { x: 1, y: 2 });
    expect(arrow).toEqual({
      kind: 'arrow',
      colour: 'red',
      from: { x: 1, y: 2 },
      to: { x: 1, y: 2 },
    });
    expect(extendShape(arrow, { x: 50, y: 60 }, 3)).toMatchObject({ to: { x: 50, y: 60 } });
  });

  it('only adds freehand points once the finger has moved far enough', () => {
    let line = startShape('freehand', 'blue', { x: 0, y: 0 });
    line = extendShape(line, { x: 1, y: 1 }, 5);
    expect(line).toMatchObject({ points: [{ x: 0, y: 0 }] });
    line = extendShape(line, { x: 6, y: 0 }, 5);
    expect(line).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
    });
  });

  it('drops accidental taps but keeps a freehand dot', () => {
    expect(isWorthKeeping(box, 16)).toBe(true);
    expect(isWorthKeeping({ ...box, to: { x: 12, y: 40 } }, 16)).toBe(false);
    expect(isWorthKeeping(startShape('arrow', 'red', { x: 0, y: 0 }), 16)).toBe(false);
    expect(isWorthKeeping(startShape('freehand', 'red', { x: 0, y: 0 }), 16)).toBe(true);
  });

  it('tidies text labels', () => {
    expect(makeTextShape('red', { x: 1, y: 1 }, '  Loop   of\nHenle ')).toMatchObject({
      text: 'Loop of Henle',
    });
    expect(makeTextShape('red', { x: 1, y: 1 }, '   ')).toBeNull();
    const long = makeTextShape('red', { x: 1, y: 1 }, 'x'.repeat(100));
    expect(long?.kind === 'text' && long.text.length).toBe(MAX_TEXT_LENGTH);
  });
});

describe('geometry', () => {
  it('normalises a rectangle dragged in any direction', () => {
    expect(rectBetween({ x: 50, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 30,
    });
  });

  it('puts the arrow head at the end point, pointing along the shaft', () => {
    const { shaft, head } = arrowPaths({ x: 0, y: 0 }, { x: 100, y: 0 }, 5);
    // Head length 20 (4 × pen), half-width 11; the shaft stops halfway into the head.
    expect(head).toBe('M 100 0 L 80 11 L 80 -11 Z');
    expect(shaft).toBe('M 0 0 L 90 0');
  });

  it('keeps the head no longer than most of a short arrow', () => {
    const { head } = arrowPaths({ x: 0, y: 0 }, { x: 0, y: 10 }, 5);
    expect(head).toBe('M 0 10 L -3.3 4 L 3.3 4 Z');
  });

  it('smooths freehand lines through the midpoints', () => {
    expect(freehandPath([])).toBe('');
    expect(freehandPath([{ x: 1, y: 2 }])).toBe('M 1 2 L 1 2');
    expect(
      freehandPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe('M 0 0 Q 10 0 10 5 L 10 10');
  });

  it('centres text on the tapped point and keeps it inside the image', () => {
    const image = { width: 200, height: 100 };
    expect(textOrigin({ x: 100, y: 50 }, 40, 20, image)).toEqual({ x: 80, y: 57 });
    expect(textOrigin({ x: 5, y: 0 }, 40, 20, image)).toEqual({ x: 0, y: 20 });
    expect(textOrigin({ x: 199, y: 99 }, 40, 20, image)).toEqual({ x: 160, y: 100 });
  });
});

describe('undo and redo', () => {
  it('undoes and redoes shapes in order', () => {
    let h = addShape(addShape(startHistory(), box), label);
    expect(h.present).toEqual([box, label]);
    h = undo(h);
    expect(h.present).toEqual([box]);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toEqual([box, label]);
    expect(canRedo(h)).toBe(false);
  });

  it('clears redo when something new is drawn', () => {
    const h = addShape(undo(addShape(startHistory(), box)), label);
    expect(h.present).toEqual([label]);
    expect(canRedo(h)).toBe(false);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const h = startHistory([box]);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it(`keeps at most ${MAX_HISTORY} undo steps`, () => {
    let h = startHistory();
    for (let i = 0; i < MAX_HISTORY + 20; i++) h = addShape(h, box);
    expect(h.past).toHaveLength(MAX_HISTORY);
  });

  it('knows whether the drawing changed since it opened', () => {
    const h = startHistory([box]);
    expect(hasChanges(h, [box])).toBe(false);
    expect(hasChanges(addShape(h, label), [box])).toBe(true);
    expect(hasChanges(undo(addShape(h, label)), [box])).toBe(false);
  });
});

describe('drawingReducer', () => {
  it('draws a box with a drag and keeps it on release', () => {
    let state = startDrawing();
    state = drawingReducer(state, {
      type: 'start',
      tool: 'box',
      colour: 'green',
      at: { x: 0, y: 0 },
    });
    state = drawingReducer(state, { type: 'move', to: { x: 30, y: 30 }, minStep: 2 });
    expect(visibleShapes(state)).toHaveLength(1);
    expect(state.history.present).toHaveLength(0);
    state = drawingReducer(state, { type: 'end', minDrag: 10 });
    expect(state.draft).toBeNull();
    expect(state.history.present).toEqual([
      { kind: 'box', colour: 'green', from: { x: 0, y: 0 }, to: { x: 30, y: 30 } },
    ]);
  });

  it('throws away a tap and a cancelled drag', () => {
    let state = startDrawing([box]);
    state = drawingReducer(state, {
      type: 'start',
      tool: 'circle',
      colour: 'red',
      at: { x: 0, y: 0 },
    });
    state = drawingReducer(state, { type: 'end', minDrag: 10 });
    expect(state.history.present).toEqual([box]);
    expect(canUndo(state.history)).toBe(false);

    state = drawingReducer(state, {
      type: 'start',
      tool: 'arrow',
      colour: 'red',
      at: { x: 0, y: 0 },
    });
    state = drawingReducer(state, { type: 'cancel' });
    expect(visibleShapes(state)).toEqual([box]);
    // A late "move"/"end" after a cancel changes nothing.
    expect(drawingReducer(state, { type: 'move', to: { x: 9, y: 9 }, minStep: 1 })).toBe(state);
    expect(drawingReducer(state, { type: 'end', minDrag: 1 })).toBe(state);
  });

  it('adds text labels and undoes them', () => {
    let state = startDrawing();
    state = drawingReducer(state, {
      type: 'addText',
      colour: 'red',
      at: { x: 1, y: 1 },
      text: ' ',
    });
    expect(state.history.present).toEqual([]);
    state = drawingReducer(state, {
      type: 'addText',
      colour: 'red',
      at: { x: 1, y: 1 },
      text: 'SAMPLE label',
    });
    expect(state.history.present).toHaveLength(1);
    state = drawingReducer(state, { type: 'undo' });
    expect(state.history.present).toEqual([]);
    state = drawingReducer(state, { type: 'redo' });
    expect(state.history.present).toHaveLength(1);
  });
});

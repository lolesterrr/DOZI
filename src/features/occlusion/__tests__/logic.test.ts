import {
  boxBetween,
  emptyOcclusion,
  finishMasks,
  hitTest,
  liveMasks,
  maskEditorReducer,
  maskId,
  maskLabels,
  MAX_MASKS,
  moveMask,
  numberedPicture,
  occlusionPicture,
  occlusionProblem,
  occlusionToJson,
  parseOcclusionJson,
  resizeMask,
  startMaskEditor,
  type Mask,
  type MaskEditorAction,
  type MaskEditorState,
  type OcclusionDraft,
} from '../logic';

// SAMPLE masks for tests only — made-up labels, no drug facts.
const mask = (n: number, x: number, y: number, w = 0.2, h = 0.1, label = ''): Mask => ({
  id: maskId(n),
  x,
  y,
  w,
  h,
  label,
});

const diagram = (masks: Mask[], mode: OcclusionDraft['mode'] = 'hide_one'): OcclusionDraft => ({
  mediaId: 'img',
  width: 1600,
  height: 1200,
  mode,
  masks,
  nextMask: masks.length + 1,
});

const reach = { x: 0.05, y: 0.05 };

function run(state: MaskEditorState, ...actions: MaskEditorAction[]): MaskEditorState {
  return actions.reduce(maskEditorReducer, state);
}

const draw = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  [
    { type: 'press', at: from, reach },
    { type: 'drag', to },
    { type: 'release' },
  ] as MaskEditorAction[];

describe('saving and loading', () => {
  it('round-trips through occlusion_json', () => {
    const draft = diagram([mask(1, 0.1, 0.1, 0.2, 0.1, 'SAMPLE A'), mask(2, 0.5, 0.5)], 'hide_all');
    const json = occlusionToJson(draft);
    expect(JSON.parse(json)).toMatchObject({ version: 1, media_id: 'img', mode: 'hide_all' });
    expect(parseOcclusionJson(json)).toEqual(draft);
  });

  it('refuses anything that does not match the schema', () => {
    expect(parseOcclusionJson(null)).toBeNull();
    expect(parseOcclusionJson('not json')).toBeNull();
    expect(parseOcclusionJson('{"version":2}')).toBeNull();
    const bad = JSON.parse(occlusionToJson(diagram([mask(1, 0.1, 0.1)])));
    bad.masks[0].x = 1.5;
    expect(parseOcclusionJson(JSON.stringify(bad))).toBeNull();
  });

  it('never hands out a box number already used, even if next_mask is behind', () => {
    const raw = JSON.parse(occlusionToJson(diagram([mask(7, 0.1, 0.1)])));
    raw.next_mask = 2;
    expect(parseOcclusionJson(JSON.stringify(raw))?.nextMask).toBe(8);
  });

  it('needs an image and at least one box', () => {
    expect(occlusionProblem(emptyOcclusion())).toBe('noImage');
    expect(occlusionProblem(diagram([]))).toBe('noMasks');
    expect(occlusionProblem(diagram([mask(1, 0, 0)]))).toBeNull();
    const many = Array.from({ length: MAX_MASKS + 1 }, (_, i) => mask(i + 1, 0, 0));
    expect(occlusionProblem(diagram(many))).toBe('tooManyMasks');
  });

  it('lists the labels typed, in box order', () => {
    const draft = diagram([
      mask(1, 0, 0, 0.1, 0.1, ' B '),
      mask(2, 0, 0),
      mask(3, 0, 0, 0.1, 0.1, 'A'),
    ]);
    expect(maskLabels(draft)).toEqual(['B', 'A']);
  });
});

describe('what a card shows', () => {
  const masks = [mask(1, 0.1, 0.1), mask(2, 0.4, 0.4), mask(3, 0.7, 0.7)];

  it('hide one: only the asked box is covered; revealing outlines it', () => {
    const question = occlusionPicture(diagram(masks, 'hide_one'), maskId(2), false)!;
    expect(question.boxes.map((b) => b.look)).toEqual(['asked']);
    expect(question.boxes[0]).toMatchObject({ x: 0.4, y: 0.4 });
    expect(question).toMatchObject({ asked: 2, total: 3, revealed: false });
    const answer = occlusionPicture(diagram(masks, 'hide_one'), maskId(2), true)!;
    expect(answer.boxes.map((b) => b.look)).toEqual(['revealed']);
  });

  it('hide all: the other boxes stay covered on both sides', () => {
    const question = occlusionPicture(diagram(masks, 'hide_all'), maskId(3), false)!;
    expect(question.boxes.map((b) => b.look)).toEqual(['covered', 'covered', 'asked']);
    const answer = occlusionPicture(diagram(masks, 'hide_all'), maskId(3), true)!;
    expect(answer.boxes.map((b) => b.look)).toEqual(['covered', 'covered', 'revealed']);
  });

  it('numbers every box for the editor', () => {
    const picture = numberedPicture(diagram(masks))!;
    expect(picture.boxes.map((b) => [b.look, b.number])).toEqual([
      ['numbered', 1],
      ['numbered', 2],
      ['numbered', 3],
    ]);
    expect(numberedPicture(emptyOcclusion())).toBeNull();
  });
});

describe('geometry', () => {
  it('makes a box from a drag in any direction, kept on the image', () => {
    expect(boxBetween({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.1 })).toEqual({
      x: 0.2,
      y: 0.1,
      w: 0.3,
      h: expect.closeTo(0.5),
    });
    expect(boxBetween({ x: -0.2, y: 0.5 }, { x: 1.4, y: 0.6 })).toMatchObject({ x: 0, w: 1 });
  });

  it('moves a box but stops it at the edges', () => {
    expect(moveMask(mask(1, 0.1, 0.1), 0.1, 0.2)).toMatchObject({
      x: expect.closeTo(0.2),
      y: expect.closeTo(0.3),
    });
    expect(moveMask(mask(1, 0.1, 0.1), -1, 5)).toMatchObject({ x: 0, y: 0.9 });
  });

  it('resizes from a corner; the opposite corner stays and the box never inverts', () => {
    const m = mask(1, 0.2, 0.2, 0.2, 0.2);
    const bigger = resizeMask(m, 'br', { x: 0.6, y: 0.7 });
    expect(bigger).toMatchObject({
      x: 0.2,
      y: 0.2,
      w: expect.closeTo(0.4),
      h: expect.closeTo(0.5),
    });
    const fromTopLeft = resizeMask(m, 'tl', { x: 0.1, y: 0.15 });
    expect(fromTopLeft).toMatchObject({ x: 0.1, y: 0.15, w: expect.closeTo(0.3) });
    const inverted = resizeMask(m, 'tr', { x: 0.0, y: 0.9 });
    expect(inverted.w).toBeCloseTo(0.02);
    expect(inverted.h).toBeCloseTo(0.02);
    expect(inverted.x).toBe(0.2);
  });

  it('finds the selected box’s corner first, then the topmost box', () => {
    const masks = [mask(1, 0.1, 0.1, 0.4, 0.4), mask(2, 0.3, 0.3, 0.4, 0.4)];
    expect(hitTest(masks, { x: 0.35, y: 0.35 }, reach, null)).toEqual({ id: 'm002', part: 'body' });
    expect(hitTest(masks, { x: 0.15, y: 0.15 }, reach, null)).toEqual({ id: 'm001', part: 'body' });
    // A corner of the selected box, even where it overlaps another box.
    expect(hitTest(masks, { x: 0.49, y: 0.51 }, reach, 'm001')).toEqual({ id: 'm001', part: 'br' });
    expect(hitTest(masks, { x: 0.9, y: 0.05 }, reach, null)).toBeNull();
  });
});

describe('box editor', () => {
  const start = () => startMaskEditor(diagram([]));

  it('draws a box, numbers it and selects it', () => {
    const state = run(start(), ...draw({ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.2 }));
    expect(state.masks).toEqual([
      { id: 'm001', label: '', x: 0.1, y: 0.1, w: expect.closeTo(0.2), h: expect.closeTo(0.1) },
    ]);
    expect(state.selectedId).toBe('m001');
    expect(state.nextMask).toBe(2);
  });

  it('shows the box being drawn before the finger lifts', () => {
    const state = run(
      start(),
      { type: 'press', at: { x: 0.1, y: 0.1 }, reach },
      {
        type: 'drag',
        to: { x: 0.4, y: 0.4 },
      },
    );
    expect(state.masks).toEqual([]);
    expect(liveMasks(state)).toHaveLength(1);
  });

  it('a tap on empty image clears the selection and adds nothing', () => {
    const drawn = run(start(), ...draw({ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.2 }));
    const tapped = run(drawn, ...draw({ x: 0.8, y: 0.8 }, { x: 0.805, y: 0.8 }));
    expect(tapped.masks).toHaveLength(1);
    expect(tapped.selectedId).toBeNull();
  });

  it('moves a box by dragging it, and resizes it by a corner', () => {
    let state = run(start(), ...draw({ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }));
    state = run(state, ...draw({ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.4 }));
    expect(state.masks[0]).toMatchObject({ x: expect.closeTo(0.4), y: expect.closeTo(0.3) });
    // The selected box's bottom-right corner is at (0.6, 0.5).
    state = run(state, ...draw({ x: 0.6, y: 0.5 }, { x: 0.9, y: 0.9 }));
    expect(state.masks[0]).toMatchObject({
      x: expect.closeTo(0.4),
      w: expect.closeTo(0.5),
      h: expect.closeTo(0.6),
    });
    expect(state.masks).toHaveLength(1);
  });

  it('labels and deletes a box; a deleted box’s number is not reused', () => {
    let state = run(
      start(),
      ...draw({ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }),
      ...draw({ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.7 }),
    );
    state = run(state, { type: 'label', id: 'm001', label: '  SAMPLE   label ' });
    expect(state.masks[0].label).toBe('SAMPLE label ');
    expect(finishMasks(state.masks)[0].label).toBe('SAMPLE label');
    state = run(state, { type: 'delete', id: 'm002' });
    expect(state.masks.map((m) => m.id)).toEqual(['m001']);
    state = run(state, ...draw({ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.7 }));
    expect(state.masks.map((m) => m.id)).toEqual(['m001', 'm003']);
  });

  it('stops at the most boxes a diagram can have', () => {
    const full = Array.from({ length: MAX_MASKS }, (_, i) => mask(i + 1, 0.9, 0.9, 0.05, 0.05));
    const state = run(
      startMaskEditor(diagram(full)),
      ...draw({ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }),
    );
    expect(state.masks).toHaveLength(MAX_MASKS);
    expect(state.full).toBe(true);
  });
});

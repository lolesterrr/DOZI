// The app's navigation shell: which tabs exist and what "+ Create" offers (PRODUCT_SPEC §2).
// Kept free of React so the order and contents can be unit-tested.

export const tabRoutes = ['index', 'learn', 'practice', 'library', 'me'] as const;
export type TabRoute = (typeof tabRoutes)[number];

/** Tabs that show the floating "+ Create" button. */
export const tabsWithCreateButton: readonly TabRoute[] = ['index', 'library'];

export const createActions = ['note', 'deck', 'card', 'quiz', 'scan'] as const;
export type CreateAction = (typeof createActions)[number];

export function showsCreateButton(tab: TabRoute): boolean {
  return tabsWithCreateButton.includes(tab);
}

// ---- Tab bar shape ------------------------------------------------------------------------------
// The tab bar is a rounded bar with a dip ("notch") in its top edge under the current tab, where
// that tab's icon floats in a circle. Everything is in dp, measured from the top-left of the bar's
// drawing area, which starts `tabBarGeometry.top` above the bar so the circle has room.

export const tabBarGeometry = {
  /** Room above the bar for the part of the circle that sticks out. */
  top: 30,
  /** Height of the bar itself. */
  height: 64,
  /** Corner radius of the bar. */
  radius: 22,
  /** Space between the bar's ends and the first/last tab. */
  padding: 22,
  /** Half the width of the dip, measured along the top edge. */
  notchHalfWidth: 50,
  /** How far the dip goes down into the bar. */
  notchDepth: 31,
  /** The floating circle's diameter. */
  circle: 50,
  /** Space between the circle and the bottom of the dip. */
  circleGap: 7,
  /** The smallest top corner left beside the dip at either end of the bar. */
  minCorner: 10,
  /** How far below the bar the ink layer shows (matches the doodle cards). */
  layer: 3,
} as const;

/** The x position of a tab's centre, for `count` tabs spread across a bar `width` wide. */
export function tabCentre(width: number, count: number, index: number): number {
  'worklet';
  const { padding } = tabBarGeometry;
  const slot = (width - 2 * padding) / count;
  return padding + slot * (index + 0.5);
}

/** Where the floating circle's centre sits, measured down from the top of the drawing area. */
export function circleCentreY(): number {
  'worklet';
  const { top, notchDepth, circle, circleGap } = tabBarGeometry;
  return top + notchDepth - circleGap - circle / 2;
}

export type NotchedBarOptions = {
  /** Full width of the drawing area. */
  width: number;
  /** Centre of the dip. */
  notchX: number;
  /** 0 = flat top, 1 = full-depth dip (the dip flattens a little while it slides). */
  depthScale?: number;
};

/** Rounds to 0.1 dp to keep the path short. */
const r = (n: number) => {
  'worklet';
  return Math.round(n * 10) / 10;
};

/**
 * An SVG path for the bar: a rounded rectangle whose top edge dips smoothly down under `notchX`.
 * The outline is inset by 1 dp so a 2 dp stroke isn't clipped at the edges. Near the ends of the
 * bar the top corner shrinks so the dip can reach the first and last tab.
 */
export function notchedBarPath({ width, notchX, depthScale = 1 }: NotchedBarOptions): string {
  'worklet';
  const { top, height, radius, notchHalfWidth, notchDepth, minCorner } = tabBarGeometry;
  const left = 1;
  const right = width - 1;
  const bottom = top + height - 1;
  const depth = notchDepth * Math.min(Math.max(depthScale, 0), 1);
  // Near the ends the dip gets narrower so a small rounded corner always stays beside it.
  const hl = Math.max(Math.min(notchHalfWidth, notchX - left - minCorner), 0);
  const hr = Math.max(Math.min(notchHalfWidth, right - notchX - minCorner), 0);
  const start = notchX - hl;
  const end = notchX + hr;
  const rl = Math.min(start - left, radius);
  const rr = Math.min(right - end, radius);
  return [
    `M ${r(left)} ${r(top + rl)}`,
    `A ${r(rl)} ${r(rl)} 0 0 1 ${r(left + rl)} ${r(top)}`,
    `L ${r(start)} ${r(top)}`,
    // Left half of the dip: leaves the top edge flat and arrives at the bottom flat.
    `C ${r(start + hl * 0.5)} ${r(top)} ${r(notchX - hl * 0.55)} ${r(top + depth)} ${r(notchX)} ${r(top + depth)}`,
    `C ${r(notchX + hr * 0.55)} ${r(top + depth)} ${r(end - hr * 0.5)} ${r(top)} ${r(end)} ${r(top)}`,
    `L ${r(right - rr)} ${r(top)}`,
    `A ${r(rr)} ${r(rr)} 0 0 1 ${r(right)} ${r(top + rr)}`,
    `L ${r(right)} ${r(bottom - radius)}`,
    `A ${radius} ${radius} 0 0 1 ${r(right - radius)} ${r(bottom)}`,
    `L ${r(left + radius)} ${r(bottom)}`,
    `A ${radius} ${radius} 0 0 1 ${r(left)} ${r(bottom - radius)}`,
    'Z',
  ].join(' ');
}

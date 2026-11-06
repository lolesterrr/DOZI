import {
  circleCentreY,
  createActions,
  notchedBarPath,
  showsCreateButton,
  tabBarGeometry,
  tabCentre,
  tabRoutes,
} from '../logic';

/** The x/y pairs in an SVG path (arc commands' radii and flags are skipped). */
function points(path: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const cmd of path.match(/[MLCA][^MLCAZ]*/g) ?? []) {
    const nums = cmd.slice(1).trim().split(/\s+/).map(Number);
    const coords = cmd[0] === 'A' ? nums.slice(5) : nums;
    for (let i = 0; i < coords.length; i += 2) out.push({ x: coords[i]!, y: coords[i + 1]! });
  }
  return out;
}

describe('navigation shell', () => {
  it('has the five tabs in the order the spec lists them', () => {
    expect(tabRoutes).toEqual(['index', 'learn', 'practice', 'library', 'me']);
  });

  it('shows "+ Create" only on Today and Library', () => {
    expect(tabRoutes.filter(showsCreateButton)).toEqual(['index', 'library']);
  });

  it('offers the five create actions from the spec', () => {
    expect(createActions).toEqual(['note', 'deck', 'card', 'quiz', 'scan']);
  });

  describe('tab bar shape', () => {
    const width = 351;
    const { top, notchDepth, height, circle } = tabBarGeometry;

    it('spreads the tab centres evenly and symmetrically', () => {
      const centres = [0, 1, 2, 3, 4].map((i) => tabCentre(width, 5, i));
      expect(centres[2]).toBeCloseTo(width / 2);
      expect(centres[0]! + centres[4]!).toBeCloseTo(width);
      expect(centres[1]! - centres[0]!).toBeCloseTo(centres[2]! - centres[1]!);
    });

    it('dips to full depth under the current tab', () => {
      const cx = tabCentre(width, 5, 1);
      const pts = points(notchedBarPath({ width, notchX: cx }));
      const nearDip = pts.filter((p) => Math.abs(p.x - cx) <= tabBarGeometry.notchHalfWidth);
      const lowestTop = Math.max(...nearDip.map((p) => p.y));
      expect(lowestTop).toBeCloseTo(top + notchDepth, 0);
      const atBottom = pts.filter((p) => Math.abs(p.y - (top + notchDepth)) < 0.1);
      expect(atBottom.some((p) => Math.abs(p.x - cx) < 0.1)).toBe(true);
    });

    it('goes flat when the depth scale is 0', () => {
      const pts = points(notchedBarPath({ width, notchX: width / 2, depthScale: 0 }));
      expect(pts.every((p) => p.y <= top + 0.01 || p.y >= top + 22 - 0.01)).toBe(true);
    });

    it('stays inside the drawing area even for the first and last tab', () => {
      for (const index of [0, 4]) {
        const pts = points(notchedBarPath({ width, notchX: tabCentre(width, 5, index) }));
        for (const p of pts) {
          expect(p.x).toBeGreaterThanOrEqual(1);
          expect(p.x).toBeLessThanOrEqual(width - 1);
          expect(p.y).toBeGreaterThanOrEqual(top);
          expect(p.y).toBeLessThanOrEqual(top + height);
        }
      }
    });

    it('floats the circle above the bottom of the dip with room to spare', () => {
      const circleBottom = circleCentreY() + circle / 2;
      expect(circleBottom).toBeLessThan(top + notchDepth);
      expect(circleCentreY() - circle / 2).toBeGreaterThanOrEqual(0);
    });
  });
});

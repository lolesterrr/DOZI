import { clampProgress, confettiPieces, countUpValue, ringGeometry, toPercent } from '../logic';

describe('clampProgress', () => {
  it('keeps values between 0 and 1', () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(0.4)).toBe(0.4);
    expect(clampProgress(3)).toBe(1);
  });

  it('treats NaN and Infinity as 0', () => {
    expect(clampProgress(NaN)).toBe(0);
    expect(clampProgress(Infinity)).toBe(0);
  });
});

describe('toPercent', () => {
  it('rounds to a whole percent', () => {
    expect(toPercent(0.456)).toBe(46);
    expect(toPercent(1.2)).toBe(100);
  });
});

describe('ringGeometry', () => {
  it('fits the circle inside the stroke', () => {
    const g = ringGeometry(72, 8, 0);
    expect(g.radius).toBe(32);
    expect(g.center).toBe(36);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 32);
  });

  it('offsets the dash by the missing fraction', () => {
    const g = ringGeometry(100, 10, 0.25);
    expect(g.dashOffset).toBeCloseTo(g.circumference * 0.75);
    expect(ringGeometry(100, 10, 1).dashOffset).toBeCloseTo(0);
    expect(ringGeometry(100, 10, 0).dashOffset).toBeCloseTo(g.circumference);
  });
});

describe('countUpValue', () => {
  it('starts at from, ends at to and never overshoots', () => {
    expect(countUpValue(0, 40, 0)).toBe(0);
    expect(countUpValue(0, 40, 1)).toBe(40);
    expect(countUpValue(0, 40, 5)).toBe(40);
    expect(countUpValue(0, 40, -1)).toBe(0);
  });
  it('eases out: more than halfway at half the time', () => {
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50);
  });
});

describe('confettiPieces', () => {
  it('gives the same pieces for the same seed, in range', () => {
    const a = confettiPieces(24, 7);
    expect(a).toEqual(confettiPieces(24, 7));
    expect(a).toHaveLength(24);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1);
      expect(p.duration).toBeGreaterThan(1000);
    }
    expect(confettiPieces(24, 8)).not.toEqual(a);
    expect(confettiPieces(0)).toEqual([]);
  });
});

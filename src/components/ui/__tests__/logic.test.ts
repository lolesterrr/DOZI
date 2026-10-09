import { clampProgress, ringGeometry, toPercent } from '../logic';

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

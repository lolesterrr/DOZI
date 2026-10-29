// Pure helpers for UI primitives (unit-tested in __tests__/logic.test.ts).

/** Clamps a progress value to 0…1. NaN and non-finite values count as 0. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 0.456 → 46 (whole percent, for labels and accessibility values). */
export function toPercent(value: number): number {
  return Math.round(clampProgress(value) * 100);
}

/** Circle geometry for a ProgressRing of the given outer size and stroke width. */
export function ringGeometry(size: number, strokeWidth: number, progress: number) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  return {
    radius: r,
    center: size / 2,
    circumference,
    dashOffset: circumference * (1 - clampProgress(progress)),
  };
}

/** A number counting up: where it is `progress` (0…1) of the way from `from` to `to`, eased out. */
export function countUpValue(from: number, to: number, progress: number): number {
  const t = clampProgress(progress);
  const eased = 1 - (1 - t) * (1 - t) * (1 - t);
  return Math.round(from + (to - from) * eased);
}

export type ConfettiPiece = {
  /** Where it starts across the width (0…1). */
  x: number;
  /** Sideways drift while falling, as a share of the width (-0.2…0.2). */
  drift: number;
  /** Start delay and fall time, in ms. */
  delay: number;
  duration: number;
  /** Size in dp and turns while falling. */
  size: number;
  turns: number;
  /** Which of the palette colours (index, wraps). */
  colour: number;
};

/** A small, repeatable burst of confetti: the same seed always gives the same pieces. */
export function confettiPieces(count: number, seed = 1): ConfettiPiece[] {
  let state = (Math.trunc(seed) % 2147483647 || 1) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: Math.max(0, Math.trunc(count)) }, (_, i) => ({
    x: next(),
    drift: (next() - 0.5) * 0.4,
    delay: Math.round(next() * 500),
    duration: 1400 + Math.round(next() * 900),
    size: 6 + Math.round(next() * 6),
    turns: 1 + Math.round(next() * 2),
    colour: i,
  }));
}

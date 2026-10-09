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

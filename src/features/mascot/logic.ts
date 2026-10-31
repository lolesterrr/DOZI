/** A mood's loop: frame numbers, and how long (ms) each one shows. */
export type MascotLoop = { frames: readonly number[]; ms: readonly number[] };

/** The step after `step` in a loop, wrapping back to the start. */
export function nextStep(loop: MascotLoop, step: number): number {
  const n = loop.frames.length;
  return n === 0 ? 0 : (((step + 1) % n) + n) % n;
}

/** How long step `step` shows, never below 16 ms (one screen refresh) so a bad value can't spin. */
export function stepDuration(loop: MascotLoop, step: number): number {
  return Math.max(16, loop.ms[step] ?? 0);
}

/** Which step is showing `elapsed` ms after the loop started (for previews and tests). */
export function stepAt(loop: MascotLoop, elapsed: number): number {
  const total = loop.ms.reduce((sum, ms) => sum + Math.max(16, ms), 0);
  if (loop.frames.length <= 1 || total <= 0) return 0;
  let left = ((elapsed % total) + total) % total;
  for (let i = 0; i < loop.frames.length; i += 1) {
    const ms = stepDuration(loop, i);
    if (left < ms) return i;
    left -= ms;
  }
  return 0;
}

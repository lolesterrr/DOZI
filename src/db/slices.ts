/**
 * SQLite limits how many `?` values one statement may hold (999 on older builds), so a long list
 * of ids, such as 400 notes deleted at once, is sent in slices of this size.
 */
export const ID_SLICE = 500;

/** [a, b, c, d, e] with size 2 → [[a, b], [c, d], [e]]. An empty list gives no slices. */
export function inSlices<T>(items: readonly T[], size: number = ID_SLICE): T[][] {
  if (size < 1) throw new Error('Slice size must be at least 1');
  const slices: T[][] = [];
  for (let i = 0; i < items.length; i += size) slices.push(items.slice(i, i + size));
  return slices;
}

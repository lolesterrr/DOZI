import { ID_SLICE, inSlices } from '../slices';

describe('inSlices', () => {
  it('cuts a list into slices of the given size, keeping order', () => {
    expect(inSlices(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(inSlices([], 2)).toEqual([]);
  });

  it('keeps 1,200 ids under SQLite’s limit per statement', () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `id-${i}`);
    const slices = inSlices(ids);
    expect(slices.map((s) => s.length)).toEqual([ID_SLICE, ID_SLICE, 200]);
    expect(slices.flat()).toEqual(ids);
  });

  it('refuses a size below 1', () => {
    expect(() => inSlices(['a'], 0)).toThrow();
  });
});

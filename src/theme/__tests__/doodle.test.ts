import { contrastRatio } from '../contrast';
import { doodleLayer } from '../doodle';
import { courseLayers, palettes } from '../tokens';

describe('doodleLayer', () => {
  const light = palettes.light;
  const dark = palettes.dark;

  it('draws nothing for "none" and a plain ink offset for "ink"', () => {
    expect(doodleLayer(light, 'none')).toEqual({});
    expect(doodleLayer(light, 'ink', 6)).toEqual({ boxShadow: `0px 3px 0px 0px ${light.outline}` });
  });

  it('uses the quieter layer colours in dark mode', () => {
    expect(doodleLayer(dark, 'accent').boxShadow).toContain(dark['layer-accent']);
    expect(doodleLayer(dark, 'coral', 6, 'dark').boxShadow).toContain(courseLayers.dark.coral);
    expect(doodleLayer(light, 'coral', 6, 'light').boxShadow).toContain(courseLayers.light.coral);
  });
});

describe('dark mode keeps big areas quiet', () => {
  const d = palettes.dark;

  it('outlines are visible (≥ 3:1, WCAG 1.4.11) but well below text brightness', () => {
    const line = contrastRatio(d.outline, d.surface);
    expect(line).toBeGreaterThanOrEqual(3);
    expect(line).toBeLessThan(contrastRatio(d.fg, d.surface) / 2);
  });

  it('the layers under cards are muted, not glowing', () => {
    for (const layer of [
      d['layer-accent'],
      d['layer-primary'],
      ...Object.values(courseLayers.dark),
    ]) {
      expect(contrastRatio(layer, d.background)).toBeLessThan(5);
    }
  });
});

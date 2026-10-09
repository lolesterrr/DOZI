import { contrastRatio } from '../contrast';
import { colorNames, hexToRgbChannels, palettes, type ColorName } from '../tokens';

// Text/background pairs that must meet WCAG AA for normal text (4.5:1).
const textPairs: [ColorName, ColorName][] = [
  ['fg', 'background'],
  ['fg', 'surface'],
  ['fg', 'surface-muted'],
  ['fg-muted', 'background'],
  ['fg-muted', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['danger', 'surface'],
  ['success', 'surface'],
  ['on-primary', 'primary'],
  ['on-primary-soft', 'primary-soft'],
  ['on-accent', 'accent'],
  ['on-accent-soft', 'accent-soft'],
  ['on-success', 'success'],
  ['on-success-soft', 'success-soft'],
  ['on-danger', 'danger'],
  ['on-danger-soft', 'danger-soft'],
  ['on-warning-soft', 'warning-soft'],
  ['on-inverse', 'inverse'],
];

describe('palettes', () => {
  it.each(['light', 'dark'] as const)('%s defines every colour as a 6-digit hex', (scheme) => {
    for (const name of colorNames) {
      expect(palettes[scheme][name]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  describe.each(['light', 'dark'] as const)('%s mode contrast (AA)', (scheme) => {
    it.each(textPairs)('%s on %s ≥ 4.5', (fg, bg) => {
      const p = palettes[scheme];
      expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#0B6B68', '#0B6B68')).toBe(1);
  });
});

describe('CSS variables', () => {
  it('converts hex to space-separated RGB channels', () => {
    expect(hexToRgbChannels('#0B6B68')).toBe('11 107 104');
  });
});

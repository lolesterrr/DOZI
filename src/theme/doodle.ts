// The "doodle" look's coloured layer under cards and buttons (trial branch).
// It is drawn with two hard-edged box shadows: a coloured strip a few dp below the element, and
// a thin ink line under that strip, so the element looks like it sits on a second, coloured card.
// `boxShadow` works on Android (new architecture) and iOS. Pass the result as a static `style`:
// don't toggle it on press, because NativeWind remounts views whose shadow changes.
import type { ViewStyle } from 'react-native';

import type { Palette } from './tokens';

/** Which colour shows under the element. */
export type DoodleLayer = 'accent' | 'primary' | 'ink' | 'none';

/** A shadow style for the coloured under-layer. `depth` is how far it shows below, in dp. */
export function doodleLayer(colors: Palette, layer: DoodleLayer = 'accent', depth = 6): ViewStyle {
  if (layer === 'none') return {};
  if (layer === 'ink') return { boxShadow: `0px ${depth / 2}px 0px 0px ${colors.outline}` };
  const fill = layer === 'primary' ? colors.primary : colors.accent;
  // The strip is 1.5 dp narrower on each side, so the ink line frames it on three sides.
  return {
    boxShadow: `0px ${depth}px 0px -1.5px ${fill}, 0px ${depth + 0.5}px 0px 0px ${colors.outline}`,
  };
}

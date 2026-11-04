// The "doodle" look's coloured layer under cards and buttons (trial branch).
// It is drawn with two hard-edged box shadows: a coloured strip a few dp below the element, and
// a thin ink line under that strip, so the element looks like it sits on a second, coloured card.
// `boxShadow` works on Android (new architecture) and iOS. Pass the result as a static `style`:
// don't toggle it on press, because NativeWind remounts views whose shadow changes.
import type { ViewStyle } from 'react-native';

import {
  courseColourNames,
  courseLayers,
  type ColorScheme,
  type CourseColour,
  type Palette,
} from './tokens';

/**
 * Which colour shows under the element. 'ink' is a plain dark offset (the default for neutral
 * cards); 'accent' and 'primary' are the warm and cool layers; a course colour (teal, coral…)
 * marks a kind of item, e.g. coral under every deck.
 */
export type DoodleLayer = 'accent' | 'primary' | 'ink' | 'none' | CourseColour;

function isCourseColour(layer: string): layer is CourseColour {
  return (courseColourNames as readonly string[]).includes(layer);
}

/** A shadow style for the coloured under-layer. `depth` is how far it shows below, in dp. */
export function doodleLayer(
  colors: Palette,
  layer: DoodleLayer = 'ink',
  depth = 6,
  scheme: ColorScheme = 'light',
): ViewStyle {
  if (layer === 'none') return {};
  if (layer === 'ink') return { boxShadow: `0px ${depth / 2}px 0px 0px ${colors.outline}` };
  const fill = isCourseColour(layer)
    ? courseLayers[scheme][layer]
    : layer === 'primary'
      ? colors['layer-primary']
      : colors['layer-accent'];
  // The strip is 1.5 dp narrower on each side, so the ink line frames it on three sides.
  return {
    boxShadow: `0px ${depth}px 0px -1.5px ${fill}, 0px ${depth + 0.5}px 0px 0px ${colors.outline}`,
  };
}

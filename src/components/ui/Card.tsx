import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { doodleLayer, useTheme, type DoodleLayer } from '@/theme';

import { cn } from './cn';

// Doodle look: an ink outline, soft corners and a layer underneath.
const base = 'rounded-[22px] border-2 border-outline bg-surface p-4';

export type CardProps = ViewProps & {
  className?: string;
  /**
   * What shows under the card: a plain ink offset by default; a course colour for a kind of item
   * (teal notes, coral decks, violet quizzes, amber folders); 'primary' for the main study action.
   */
  layer?: DoodleLayer;
};

/** A surface panel. Use PressableCard when the whole card is tappable. */
export function Card({ className, layer = 'ink', style, ...props }: CardProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      className={cn(base, className)}
      style={[doodleLayer(colors, layer, 6, scheme), style]}
      {...props}
    />
  );
}

export type PressableCardProps = Omit<PressableProps, 'style'> & {
  className?: string;
  layer?: DoodleLayer;
  style?: ViewProps['style'];
};

export function PressableCard({ className, layer = 'ink', style, ...props }: PressableCardProps) {
  const { colors, scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(base, 'min-h-touch active:opacity-80', className)}
      style={[doodleLayer(colors, layer, 6, scheme), style]}
      {...props}
    />
  );
}

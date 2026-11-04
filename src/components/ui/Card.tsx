import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { doodleLayer, useTheme, type DoodleLayer } from '@/theme';

import { cn } from './cn';

// Doodle look: an ink outline, soft uneven corners and a coloured layer underneath.
const base = 'rounded-[22px] border-2 border-outline bg-surface p-4';

export type CardProps = ViewProps & {
  className?: string;
  /** The colour that shows under the card. Orange by default. */
  layer?: DoodleLayer;
};

/** A surface panel. Use PressableCard when the whole card is tappable. */
export function Card({ className, layer = 'accent', style, ...props }: CardProps) {
  const { colors } = useTheme();
  return (
    <View className={cn(base, className)} style={[doodleLayer(colors, layer), style]} {...props} />
  );
}

export type PressableCardProps = Omit<PressableProps, 'style'> & {
  className?: string;
  layer?: DoodleLayer;
  style?: ViewProps['style'];
};

export function PressableCard({
  className,
  layer = 'accent',
  style,
  ...props
}: PressableCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(base, 'min-h-touch active:opacity-80', className)}
      style={[doodleLayer(colors, layer), style]}
      {...props}
    />
  );
}

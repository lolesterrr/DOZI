import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { cn } from './cn';

const base = 'rounded-lg border border-border bg-surface p-4';

export type CardProps = ViewProps & { className?: string };

/** A surface panel. Use PressableCard when the whole card is tappable. */
export function Card({ className, ...props }: CardProps) {
  return <View className={cn(base, className)} {...props} />;
}

export type PressableCardProps = PressableProps & { className?: string };

export function PressableCard({ className, ...props }: PressableCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(base, 'min-h-touch active:opacity-80', className)}
      {...props}
    />
  );
}

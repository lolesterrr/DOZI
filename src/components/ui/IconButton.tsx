import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';

import { useTheme, type ColorName } from '@/theme';

import { cn } from './cn';

export type IconButtonVariant = 'ghost' | 'soft' | 'primary' | 'accent';

const containerClasses: Record<IconButtonVariant, string> = {
  ghost: 'rounded-full bg-transparent',
  // Doodle look: outlined rounded squares.
  soft: 'rounded-xl border-2 border-outline bg-surface',
  primary: 'rounded-xl border-2 border-outline bg-primary',
  accent: 'rounded-xl border-2 border-outline bg-accent',
};

const iconColour: Record<IconButtonVariant, ColorName> = {
  ghost: 'fg',
  soft: 'fg',
  primary: 'on-primary',
  accent: 'on-accent',
};

export type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: LucideIcon;
  /** Required: screen readers have no visible text to read. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  className?: string;
};

/** Round icon-only button with a 44 dp minimum touch target. */
export function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 24,
  disabled,
  className,
  ...props
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      className={cn(
        'min-h-touch min-w-touch items-center justify-center active:opacity-70',
        containerClasses[variant],
        disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <Icon color={colors[iconColour[variant]]} size={size} />
    </Pressable>
  );
}

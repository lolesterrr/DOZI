import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { useTheme, type ColorName } from '@/theme';

import { cn } from './cn';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const containerClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-primary-soft',
  outline: 'border border-border bg-surface',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const foreground: Record<ButtonVariant, ColorName> = {
  primary: 'on-primary',
  secondary: 'on-primary-soft',
  outline: 'fg',
  ghost: 'primary',
  danger: 'on-danger',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-on-primary-soft',
  outline: 'text-fg',
  ghost: 'text-primary',
  danger: 'text-on-danger',
};

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const fg = colors[foreground[variant]];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-lg px-5 active:opacity-80',
        size === 'lg' ? 'min-h-[52px]' : 'min-h-touch',
        containerClasses[variant],
        fullWidth && 'self-stretch',
        isDisabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : Icon ? (
        <View>
          <Icon color={fg} size={20} />
        </View>
      ) : null}
      <Text variant="bodyStrong" tone="inherit" className={textClasses[variant]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

import { Check, type LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';

import { useTheme } from '@/theme';

import { cn } from './cn';
import { Text } from './Text';

export type ChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  className?: string;
};

/** Filter/choice pill. Selected chips show a tick as well as a colour change. */
export function Chip({
  label,
  selected = false,
  icon: Icon,
  disabled,
  className,
  ...props
}: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors['on-primary-soft'] : colors.fg;
  const ShownIcon = selected ? Check : Icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4 }}
      className={cn(
        'min-h-[36px] flex-row items-center gap-1.5 self-start rounded-full border px-3.5 active:opacity-80',
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
        disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {ShownIcon ? <ShownIcon color={fg} size={16} /> : null}
      <Text
        variant="label"
        tone="inherit"
        className={selected ? 'text-on-primary-soft' : 'text-fg'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

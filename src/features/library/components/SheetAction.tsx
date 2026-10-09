import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export type SheetActionProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** One row in an action sheet: an icon in a soft circle and a label. */
export function SheetAction({ icon: Icon, label, onPress, danger, disabled }: SheetActionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-touch flex-row items-center gap-4 rounded-md px-2 py-3 active:bg-surface-muted',
        disabled && 'opacity-50',
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          danger ? 'bg-danger-soft' : 'bg-primary-soft',
        )}
      >
        <Icon color={colors[danger ? 'on-danger-soft' : 'on-primary-soft']} size={22} />
      </View>
      <Text variant="body" tone={danger ? 'danger' : 'default'} className="flex-1">
        {label}
      </Text>
    </Pressable>
  );
}

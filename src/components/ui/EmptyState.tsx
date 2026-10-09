import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { cn } from './cn';
import { Text } from './Text';

export type EmptyStateProps = {
  title: string;
  message?: string;
  /** A picture on top. Dozi's expressions go here once the mascot exists (task 2.x). */
  illustration?: ReactNode;
  /** Used when there is no illustration. */
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({
  title,
  message,
  illustration,
  icon: Icon,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View className={cn('items-center gap-3 px-6 py-10', className)}>
      {illustration ??
        (Icon ? (
          <View className="mb-1 h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
            <Icon color={colors['on-primary-soft']} size={36} />
          </View>
        ) : null)}
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      {message ? (
        <Text tone="muted" className="max-w-[320px] text-center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-2" />
      ) : null}
    </View>
  );
}

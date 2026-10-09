import { View } from 'react-native';

import { cn } from './cn';
import { clampProgress, toPercent } from './logic';

export type ProgressBarTone = 'primary' | 'accent' | 'success';

const fillClasses: Record<ProgressBarTone, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
};

export type ProgressBarProps = {
  /** 0…1 */
  value: number;
  tone?: ProgressBarTone;
  /** Read by screen readers, e.g. "Daily goal". */
  accessibilityLabel?: string;
  className?: string;
};

export function ProgressBar({
  value,
  tone = 'primary',
  accessibilityLabel,
  className,
}: ProgressBarProps) {
  const progress = clampProgress(value);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: toPercent(progress) }}
      className={cn('h-2.5 overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <View
        className={cn('h-full rounded-full', fillClasses[tone])}
        style={{ width: `${progress * 100}%` }}
      />
    </View>
  );
}

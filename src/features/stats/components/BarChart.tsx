import { format, parseISO } from 'date-fns';
import { View } from 'react-native';

import { cn, Text } from '@/components/ui';

import { barFraction, type DayValue } from '../logic';

export type BarChartProps = {
  data: readonly DayValue[];
  /** Read by screen readers (the bars themselves are not announced one by one). */
  accessibilityLabel: string;
  height?: number;
  /** Label under the first and last bar; defaults to the dates. */
  startLabel?: string;
  endLabel?: string;
  /** Draws today's bar (the first or last one) in the accent colour. */
  highlight?: 'first' | 'last' | null;
};

/** Simple vertical bars, one per day, scaled to the tallest. Plain views, no chart library. */
export function BarChart({
  data,
  accessibilityLabel,
  height = 96,
  startLabel,
  endLabel,
  highlight = 'last',
}: BarChartProps) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const dateLabel = (day: string) => format(parseISO(day), 'd MMM');
  const lastIndex = data.length - 1;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} className="gap-1" testID="bar-chart">
      <View className="flex-row items-end gap-0.5 border-b border-border" style={{ height }}>
        {data.map((d, i) => {
          const marked =
            (highlight === 'last' && i === lastIndex) || (highlight === 'first' && i === 0);
          return (
            <View key={d.day} className="h-full flex-1 justify-end">
              <View
                className={cn('w-full rounded-t-sm', marked ? 'bg-accent' : 'bg-primary')}
                style={{ height: `${barFraction(d.value, max) * 100}%` }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between">
        <Text variant="caption" tone="muted">
          {startLabel ?? (data.length ? dateLabel(data[0].day) : '')}
        </Text>
        <Text variant="caption" tone="muted">
          {endLabel ?? (data.length ? dateLabel(data[lastIndex].day) : '')}
        </Text>
      </View>
    </View>
  );
}

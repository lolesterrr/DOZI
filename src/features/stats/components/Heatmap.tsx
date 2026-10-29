import { View } from 'react-native';

import { cn, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

import type { HeatCell } from '../logic';
import { activeDays } from '../logic';

const s = strings.stats;

// Squares get stronger with more XP. Opacity (not a new colour) keeps it on-theme in both modes;
// the totals above the grid carry the same numbers in words.
const levelOpacity = [0, 0.3, 0.5, 0.75, 1] as const;

function Square({ level, future }: { level: HeatCell['level']; future?: boolean }) {
  if (future) return <View className="aspect-square w-full" />;
  return (
    <View className={cn('aspect-square w-full rounded-sm bg-surface-muted')}>
      {level > 0 ? (
        <View
          className="absolute inset-0 rounded-sm bg-primary"
          style={{ opacity: levelOpacity[level] }}
        />
      ) : null}
    </View>
  );
}

/** Study activity by day: weeks as columns, Monday at the top, today in the last column. */
export function Heatmap({ grid }: { grid: HeatCell[][] }) {
  const days = activeDays(grid);
  return (
    <View
      accessible
      accessibilityLabel={s.heatmapLabel(days, grid.length)}
      className="gap-2"
      testID="heatmap"
    >
      <View className="flex-row gap-1">
        {grid.map((week) => (
          <View key={week[0].day} className="flex-1 gap-1">
            {week.map((cell) => (
              <Square key={cell.day} level={cell.level} future={cell.future} />
            ))}
          </View>
        ))}
      </View>
      <View className="flex-row items-center justify-end gap-1">
        <Text variant="caption" tone="muted">
          {s.less}
        </Text>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <View key={level} className="w-4">
            <Square level={level} />
          </View>
        ))}
        <Text variant="caption" tone="muted">
          {s.more}
        </Text>
      </View>
    </View>
  );
}

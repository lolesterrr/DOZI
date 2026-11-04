import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { cn, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import type { WeekDay } from '../logic';

const SIZE = 36;

/**
 * Monday to Sunday as outlined circles that fill up from the bottom with each day's share of the
 * goal. A full day also gets a tick, and today gets an orange fill and a label, so nothing relies
 * on colour alone.
 */
export function WeekStrip({ week }: { week: WeekDay[] }) {
  const { colors } = useTheme();
  return (
    <View
      className="flex-row justify-between"
      accessibilityRole="summary"
      accessibilityLabel={strings.today.weekLabel}
    >
      {week.map((d) => {
        const name = strings.timetable.weekdaysShort[d.weekday];
        const full = d.fraction >= 1;
        return (
          <View
            key={d.day}
            accessible
            accessibilityLabel={strings.today.weekDay(
              strings.timetable.weekdays[d.weekday],
              Math.round(d.fraction * 100),
              d.isToday,
              d.isFuture,
            )}
            className="items-center gap-1"
          >
            <Text variant="caption" tone={d.isToday ? 'default' : 'muted'}>
              {d.isToday ? strings.timetable.today : name}
            </Text>
            <View
              className={cn(
                'items-center justify-center overflow-hidden rounded-full border-2 border-outline',
                d.isToday ? 'bg-accent' : 'bg-surface',
              )}
              style={{ width: SIZE, height: SIZE }}
            >
              {!d.isToday && !full && d.fraction > 0 ? (
                <View
                  className="absolute bottom-0 left-0 right-0 bg-primary-soft"
                  style={{ height: `${d.fraction * 100}%` }}
                />
              ) : null}
              {full && !d.isToday ? <View className="absolute inset-0 bg-primary" /> : null}
              {full ? (
                <Check color={d.isToday ? colors['on-accent'] : colors['on-primary']} size={18} />
              ) : (
                <Text
                  variant="caption"
                  tone="inherit"
                  className={d.isToday ? 'text-on-accent' : 'text-fg'}
                >
                  {d.date}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

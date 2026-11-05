import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn, Text } from '@/components/ui';
import type { TimetableClass } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { courseSwatch, useTheme } from '@/theme';

import {
  classesOn,
  gridRange,
  layoutDay,
  visibleWeekdays,
  type Moment,
  type Weekday,
} from '../logic';

const s = strings.timetable;

/** Height of one hour on the grid, in dp. */
export const HOUR_HEIGHT = 60;
const HOUR_COLUMN = 40;

/**
 * The whole week at a glance: one column per day (Mon–Fri, plus the weekend when used), hours
 * down the side, classes as coloured blocks. A line marks the time now on today's column.
 */
export function WeekGrid({
  classes,
  now,
  onOpen,
  onPickDay,
}: {
  classes: readonly TimetableClass[];
  now: Moment;
  onOpen: (cls: TimetableClass) => void;
  onPickDay: (day: Weekday) => void;
}) {
  const { scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const days = visibleWeekdays(classes);
  const range = gridRange(classes);
  const hours = Array.from(
    { length: range.endHour - range.startHour },
    (_, i) => range.startHour + i,
  );
  const columnWidth = width > 0 ? (width - HOUR_COLUMN) / days.length : 0;
  const nowTop = ((now.minutes - range.startHour * 60) / 60) * HOUR_HEIGHT;
  const showNow = days.includes(now.weekday) && nowTop >= 0 && nowTop <= hours.length * HOUR_HEIGHT;

  return (
    <View className="px-4" onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}>
      {/* Day names */}
      <View className="flex-row pb-2" style={{ paddingLeft: HOUR_COLUMN }}>
        {days.map((day) => {
          const isToday = day === now.weekday;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={s.dayLabel(
                s.weekdays[day],
                classesOn(classes, day).length,
                isToday,
              )}
              onPress={() => onPickDay(day)}
              className="min-h-touch items-center justify-center"
              style={{ width: columnWidth || undefined, flex: columnWidth ? undefined : 1 }}
            >
              <View className={cn('rounded-full px-2 py-1', isToday && 'bg-primary')}>
                <Text
                  variant="label"
                  tone="inherit"
                  className={isToday ? 'text-on-primary' : 'text-fg-muted'}
                >
                  {s.weekdaysShort[day]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row overflow-hidden rounded-[20px] border-2 border-outline bg-surface">
        {/* Hours */}
        <View style={{ width: HOUR_COLUMN }}>
          {hours.map((h) => (
            <View key={h} style={{ height: HOUR_HEIGHT }} className="items-center pt-1">
              <Text variant="caption" tone="muted">
                {String(h).padStart(2, '0')}
              </Text>
            </View>
          ))}
        </View>

        {/* Day columns */}
        {columnWidth > 0
          ? days.map((day) => {
              const placed = layoutDay(classesOn(classes, day), range);
              const isToday = day === now.weekday;
              return (
                <View
                  key={day}
                  className={cn('border-l border-border', isToday && 'bg-primary-soft/40')}
                  style={{ width: columnWidth, height: hours.length * HOUR_HEIGHT }}
                >
                  {hours.map((h, i) => (
                    <View
                      key={h}
                      className="absolute left-0 right-0 border-t border-border/60"
                      style={{ top: i * HOUR_HEIGHT }}
                    />
                  ))}
                  {placed.map(({ cls, top, length, lane, lanes }) => {
                    const swatch = courseSwatch(scheme, cls.colour);
                    const height = (length / 60) * HOUR_HEIGHT - 2;
                    const laneWidth = columnWidth / lanes;
                    return (
                      <Pressable
                        key={cls.id}
                        accessibilityRole="button"
                        accessibilityLabel={s.classLabel(
                          cls.title,
                          `${s.weekdays[day]} ${s.timeRange(cls.startTime, cls.endTime)}`,
                          cls.location,
                        )}
                        accessibilityHint={s.editClass}
                        onPress={() => onOpen(cls)}
                        className="absolute overflow-hidden rounded-md active:opacity-80"
                        style={{
                          top: (top / 60) * HOUR_HEIGHT + 1,
                          height: Math.max(height, 22),
                          left: lane * laneWidth + 2,
                          width: laneWidth - 4,
                          backgroundColor: swatch.fill,
                        }}
                      >
                        <View
                          className="absolute bottom-0 left-0 top-0 w-1"
                          style={{ backgroundColor: swatch.bar }}
                        />
                        <View className="py-1 pl-2 pr-1">
                          <Text
                            variant="caption"
                            tone="inherit"
                            numberOfLines={height > 50 ? 3 : 1}
                            className="font-body-semibold"
                            style={{ color: swatch.ink }}
                          >
                            {cls.code || cls.title}
                          </Text>
                          {height > 44 && laneWidth > 40 ? (
                            <Text
                              variant="caption"
                              tone="inherit"
                              numberOfLines={1}
                              style={{ color: swatch.ink }}
                            >
                              {cls.location || cls.startTime}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                  {isToday && showNow ? (
                    <View
                      pointerEvents="none"
                      className="absolute left-0 right-0 flex-row items-center"
                      style={{ top: nowTop - 4 }}
                    >
                      <View className="h-2 w-2 rounded-full bg-danger" />
                      <View className="h-0.5 flex-1 bg-danger" />
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
}

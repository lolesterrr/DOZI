import { Plus } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, cn, Text } from '@/components/ui';
import type { TimetableClass } from '@/db/schema';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { courseSwatch, useTheme } from '@/theme';

import {
  classesOn,
  parseReminders,
  toMinutes,
  weekdays,
  type Moment,
  type Weekday,
} from '../logic';
import { ClassCard } from './ClassCard';

const s = strings.timetable;

/** A row of the seven days: the chosen one filled, today ringed, a dot per class. */
export function DayStrip({
  classes,
  selected,
  today,
  onSelect,
}: {
  classes: readonly TimetableClass[];
  selected: Weekday;
  today: Weekday;
  onSelect: (day: Weekday) => void;
}) {
  const { scheme } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
    >
      {weekdays.map((day) => {
        const onDay = classesOn(classes, day);
        const isSelected = day === selected;
        const isToday = day === today;
        return (
          <Pressable
            key={day}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={s.dayLabel(s.weekdays[day], onDay.length, isToday)}
            onPress={() => onSelect(day)}
            className={cn(
              'min-h-[64px] w-[52px] items-center justify-center gap-1 rounded-lg border-2 active:opacity-80',
              isSelected ? 'border-primary bg-primary' : 'bg-surface',
              !isSelected && (isToday ? 'border-primary' : 'border-outline'),
            )}
          >
            <Text
              variant="label"
              tone="inherit"
              className={isSelected ? 'text-on-primary' : isToday ? 'text-primary' : 'text-fg'}
            >
              {s.weekdaysShort[day]}
            </Text>
            <View className="h-2 flex-row gap-0.5">
              {onDay.slice(0, 4).map((c) => (
                <View
                  key={c.id}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isSelected && 'border border-on-primary',
                  )}
                  style={{ backgroundColor: courseSwatch(scheme, c.colour).bar }}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** One day's classes as a timeline: times on the left, class cards on the right, gaps between. */
export function DayTimeline({
  classes,
  day,
  now,
  onOpen,
  onAdd,
}: {
  classes: readonly TimetableClass[];
  day: Weekday;
  now: Moment;
  onOpen: (cls: TimetableClass) => void;
  onAdd: () => void;
}) {
  const onDay = classesOn(classes, day);
  if (onDay.length === 0) {
    return (
      <View className="items-center gap-3 px-6 py-8">
        <Dozi mood="sleepy" size={96} />
        <Text variant="heading" className="text-center">
          {s.freeDay(s.weekdays[day])}
        </Text>
        <Text tone="muted" className="max-w-[300px] text-center">
          {s.freeDayMessage}
        </Text>
        <Button label={s.addClass} icon={Plus} variant="secondary" onPress={onAdd} />
      </View>
    );
  }
  return (
    <View className="px-4">
      {onDay.map((cls, i) => {
        const start = toMinutes(cls.startTime);
        const end = toMinutes(cls.endTime);
        const isToday = day === now.weekday;
        const isNow = isToday && start <= now.minutes && now.minutes < end;
        const isPast = isToday && now.minutes >= end;
        const prevEnd = i > 0 ? toMinutes(onDay[i - 1].endTime) : null;
        const gap = prevEnd !== null ? start - prevEnd : 0;
        return (
          <Fragment key={cls.id}>
            {gap >= 30 ? <FreeGap minutes={gap} /> : null}
            <TimelineRow
              cls={cls}
              isNow={isNow}
              isPast={isPast}
              progress={isNow ? (now.minutes - start) / Math.max(1, end - start) : null}
              last={i === onDay.length - 1}
              onOpen={() => onOpen(cls)}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

function TimelineRow({
  cls,
  isNow,
  isPast,
  progress,
  last,
  onOpen,
}: {
  cls: TimetableClass;
  isNow: boolean;
  isPast: boolean;
  progress: number | null;
  last: boolean;
  onOpen: () => void;
}) {
  const { scheme } = useTheme();
  const swatch = courseSwatch(scheme, cls.colour);
  return (
    <View className={cn('flex-row gap-3', isPast && 'opacity-60')}>
      <View className="w-12 items-end pt-3">
        <Text variant="bodyStrong" className={isNow ? 'text-primary' : undefined}>
          {cls.startTime}
        </Text>
        <Text variant="caption" tone="muted">
          {cls.endTime}
        </Text>
      </View>
      <View className="w-4 items-center">
        <View
          className={cn('mt-4 rounded-full', isNow ? 'h-4 w-4 border-2 border-surface' : 'h-3 w-3')}
          style={{ backgroundColor: swatch.bar }}
        />
        {!last ? <View className="w-0.5 flex-1 bg-border" /> : null}
      </View>
      <View className="flex-1 pb-3">
        <ClassCard
          cls={{ ...cls, reminderCount: parseReminders(cls.remindersJson).length }}
          progress={progress}
          onPress={onOpen}
        />
      </View>
    </View>
  );
}

function FreeGap({ minutes }: { minutes: number }) {
  return (
    <View className="flex-row gap-3 pb-3">
      <View className="w-12" />
      <View className="w-4 items-center">
        <View className="w-0.5 flex-1 bg-border" />
      </View>
      <View className="flex-1 flex-row items-center">
        <View className="rounded-full bg-surface-muted px-3 py-1">
          <Text variant="caption" tone="muted">
            {strings.timetable.free(strings.timetable.hours(minutes))}
          </Text>
        </View>
      </View>
    </View>
  );
}

import { router } from 'expo-router';
import { ArrowLeft, CalendarDays, ChevronDown, List, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, cn, IconButton, Skeleton, Text } from '@/components/ui';
import type { TimetableClass } from '@/db/schema';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useActiveTimetable, useNow } from '../hooks';
import { totalMinutes, type Weekday } from '../logic';
import { openClassEditor } from '../navigation';
import { DayStrip, DayTimeline } from './DayView';
import { TimetableSheet } from './TimetableSheet';
import { UpNextCard } from './UpNextCard';
import { WeekGrid } from './WeekGrid';

const s = strings.timetable;

type View_ = 'day' | 'week';

/** The lecture timetable (PRODUCT_SPEC §13): up next, then a day timeline or the week grid. */
export function TimetableScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { loading, timetables, active, classes } = useActiveTimetable();
  const now = useNow();
  const [view, setView] = useState<View_>('day');
  const [day, setDay] = useState<Weekday>(now.weekday);
  const [sheet, setSheet] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const open = (cls: TimetableClass) => openClassEditor(cls.id);
  const add = () => openClassEditor('new', day);
  const empty = !loading && classes.length === 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-1">
        <IconButton icon={ArrowLeft} accessibilityLabel={s.back} onPress={back} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.switchTimetable}
          onPress={() => setSheet(true)}
          className="min-h-touch flex-1 justify-center rounded-md px-2 active:bg-surface-muted"
        >
          <View className="flex-row items-center gap-1">
            <Text variant="heading" numberOfLines={1} className="shrink">
              {active?.name ?? s.title}
            </Text>
            <ChevronDown color={colors['fg-muted']} size={18} />
          </View>
          <Text variant="caption" tone="muted">
            {s.weekSummary(classes.length, s.hours(totalMinutes(classes)))}
          </Text>
        </Pressable>
        {!empty ? <ViewSwitch view={view} onChange={setView} /> : null}
      </View>

      {loading ? (
        <View className="gap-3 p-4">
          <Skeleton height={128} radius={20} />
          <Skeleton height={64} radius={12} />
          <Skeleton height={96} radius={12} />
        </View>
      ) : empty ? (
        <EmptyTimetable onAdd={add} />
      ) : (
        <ScrollView
          contentContainerClassName="gap-4 pt-2"
          contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
        >
          <View className="px-4">
            <UpNextCard classes={classes} now={now} />
          </View>
          {view === 'day' ? (
            <>
              <DayStrip classes={classes} selected={day} today={now.weekday} onSelect={setDay} />
              <View className="flex-row items-baseline justify-between px-4">
                <Text variant="heading">{s.weekdays[day]}</Text>
                {day === now.weekday ? (
                  <Text variant="label" tone="primary">
                    {s.today}
                  </Text>
                ) : null}
              </View>
              <DayTimeline classes={classes} day={day} now={now} onOpen={open} onAdd={add} />
            </>
          ) : (
            <WeekGrid
              classes={classes}
              now={now}
              onOpen={open}
              onPickDay={(d) => {
                setDay(d);
                setView('day');
              }}
            />
          )}
          <Text variant="caption" tone="muted" className="px-4 text-center">
            {strings.disclaimer}
          </Text>
        </ScrollView>
      )}

      {!empty && !loading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.addClass}
          onPress={add}
          className="absolute right-4 min-h-[56px] flex-row items-center gap-2 rounded-full bg-primary px-5 shadow-lg active:opacity-90"
          style={{ bottom: insets.bottom + 20, elevation: 6 }}
        >
          <Plus color={colors['on-primary']} size={22} />
          <Text variant="bodyStrong" tone="onPrimary">
            {s.addClass}
          </Text>
        </Pressable>
      ) : null}

      <TimetableSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        timetables={timetables}
        active={active}
      />
    </View>
  );
}

function ViewSwitch({ view, onChange }: { view: View_; onChange: (v: View_) => void }) {
  const { colors } = useTheme();
  const options = [
    { key: 'day' as const, label: s.viewDay, Icon: List },
    { key: 'week' as const, label: s.viewWeek, Icon: CalendarDays },
  ];
  return (
    <View className="flex-row rounded-full bg-surface-muted p-1" accessibilityRole="tablist">
      {options.map(({ key, label, Icon }) => {
        const on = view === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.viewLabel(label)}
            onPress={() => onChange(key)}
            // Only the colour changes between states. Adding a class like shadow-sm on press makes
            // NativeWind remount the view and, in development, crash while printing a warning.
            className={cn(
              'min-h-[40px] flex-row items-center gap-1 rounded-full px-3',
              on ? 'bg-surface' : 'bg-transparent',
            )}
          >
            <Icon color={on ? colors.primary : colors['fg-muted']} size={16} />
            <Text variant="label" tone="inherit" className={on ? 'text-primary' : 'text-fg-muted'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyTimetable({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8 pb-16">
      <Dozi mood="happy" size={140} />
      <Text variant="title" className="text-center">
        {s.emptyTitle}
      </Text>
      <Text tone="muted" className="max-w-[320px] text-center">
        {s.emptyMessage}
      </Text>
      <Button label={s.addClass} icon={Plus} size="lg" onPress={onAdd} />
    </View>
  );
}

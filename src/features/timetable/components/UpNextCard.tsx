import { Clock, MapPin } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import type { TimetableClass } from '@/db/schema';
import { Dozi, type DoziMood } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { courseSwatch, useTheme } from '@/theme';

import { describeUntil, nowAndNext, shiftWeekday, type Moment } from '../logic';

const s = strings.timetable;

/**
 * The big card at the top of the timetable: the class on now (with how far through it is) or the
 * next one and how long until it starts, with Monsieur Pierre beside it.
 */
export function UpNextCard({
  classes,
  now,
  size = 'large',
}: {
  classes: readonly TimetableClass[];
  now: Moment;
  size?: 'large' | 'small';
}) {
  const { colors, scheme } = useTheme();
  const { current, next } = nowAndNext(classes, now);
  const shown = current?.cls ?? next?.cls ?? null;
  const swatch = shown ? courseSwatch(scheme, shown.colour) : null;
  const pierreSize = size === 'large' ? 84 : 64;

  let label: string;
  let title: string;
  let detail: string;
  let mood: DoziMood;
  if (current) {
    label = s.nowTitle;
    title = current.cls.title;
    detail = s.nowUntil(current.cls.endTime, current.minutesLeft);
    mood = 'studying';
  } else if (next) {
    label = s.nextTitle;
    title = next.cls.title;
    const when = describeUntil(next, next.cls.startTime, shiftWeekday(now.weekday, next.daysAhead));
    detail = `${s.timeRange(next.cls.startTime, next.cls.endTime)} · ${when}`;
    mood = next.daysAhead === 0 && next.minutesUntil <= 60 ? 'encouraging' : 'idle';
  } else {
    label = s.nextTitle;
    title = s.nothingNext;
    detail = s.nothingNextMessage;
    mood = 'sleepy';
  }

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${title}. ${detail}${shown?.location ? `. ${shown.location}` : ''}`}
      className="flex-row items-center gap-3 overflow-hidden rounded-xl bg-primary p-4"
    >
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full bg-accent" />
          <Text variant="caption" tone="onPrimary" className="font-body-semibold uppercase">
            {label}
          </Text>
        </View>
        <Text variant={size === 'large' ? 'title' : 'heading'} tone="onPrimary" numberOfLines={2}>
          {shown?.code ? `${shown.code} · ${title}` : title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Clock color={colors['on-primary']} size={14} />
          <Text variant="small" tone="onPrimary" className="flex-1">
            {detail}
          </Text>
        </View>
        {shown?.location ? (
          <View className="flex-row items-center gap-1.5">
            <MapPin color={colors['on-primary']} size={14} />
            <Text variant="small" tone="onPrimary" numberOfLines={1} className="flex-1">
              {shown.location}
            </Text>
          </View>
        ) : null}
        {current ? (
          <View className="mt-1 h-2 overflow-hidden rounded-full bg-on-primary/25">
            <View
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(current.progress * 100)}%` }}
            />
          </View>
        ) : null}
      </View>
      <View className="items-center">
        <Dozi mood={mood} size={pierreSize} />
        {swatch ? (
          <View className="mt-2 h-1.5 w-10 rounded-full" style={{ backgroundColor: swatch.bar }} />
        ) : null}
      </View>
    </View>
  );
}

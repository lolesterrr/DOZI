import { Bell, BellOff, MapPin, UserRound } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, Text } from '@/components/ui';
import type { ClassKind } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { courseSwatch, useTheme } from '@/theme';

const s = strings.timetable;

export type ClassCardData = {
  title: string;
  code: string;
  kind: ClassKind;
  startTime: string;
  endTime: string;
  location: string;
  lecturer: string;
  colour: string;
  reminderCount: number;
};

export type ClassCardProps = {
  cls: ClassCardData;
  onPress?: () => void;
  /** 0–1 while the class is on now: shows "On now" and how far through it is. */
  progress?: number | null;
  className?: string;
};

/** One class on the day view (and the editor's preview), in its course colour. */
export function ClassCard({ cls, onPress, progress = null, className }: ClassCardProps) {
  const { scheme } = useTheme();
  const swatch = courseSwatch(scheme, cls.colour);
  const ink = { color: swatch.ink };
  const BellIcon = cls.reminderCount > 0 ? Bell : BellOff;
  const time = s.timeRange(cls.startTime, cls.endTime);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={s.classLabel(cls.title || s.newClass, time, cls.location)}
      accessibilityHint={onPress ? s.editClass : undefined}
      disabled={!onPress}
      onPress={onPress}
      className={cn('overflow-hidden rounded-lg active:opacity-80', className)}
      style={{ backgroundColor: swatch.fill }}
    >
      <View
        className="absolute bottom-0 left-0 top-0 w-1.5"
        style={{ backgroundColor: swatch.bar }}
      />
      <View className="gap-1.5 py-3 pl-5 pr-4">
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            {cls.code ? (
              <Text variant="caption" tone="inherit" style={ink} className="font-body-semibold">
                {cls.code.toUpperCase()}
              </Text>
            ) : null}
            <Text variant="bodyStrong" tone="inherit" style={ink} numberOfLines={2}>
              {cls.title || s.newClass}
            </Text>
          </View>
          {progress !== null ? (
            <View
              className="flex-row items-center gap-1 rounded-full border-2 px-2 py-0.5"
              style={{ borderColor: swatch.bar }}
            >
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch.bar }} />
              <Text variant="caption" tone="inherit" style={ink} className="font-body-semibold">
                {s.nowTitle}
              </Text>
            </View>
          ) : (
            <View className="rounded-full border px-2 py-0.5" style={{ borderColor: swatch.bar }}>
              <Text variant="caption" tone="inherit" style={ink}>
                {s.kinds[cls.kind]}
              </Text>
            </View>
          )}
        </View>
        <Text variant="small" tone="inherit" style={ink}>
          {time}
        </Text>
        {cls.location || cls.lecturer ? (
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
            {cls.location ? (
              <View className="flex-row items-center gap-1">
                <MapPin color={swatch.ink} size={14} />
                <Text variant="small" tone="inherit" style={ink} numberOfLines={1}>
                  {cls.location}
                </Text>
              </View>
            ) : null}
            {cls.lecturer ? (
              <View className="flex-row items-center gap-1">
                <UserRound color={swatch.ink} size={14} />
                <Text variant="small" tone="inherit" style={ink} numberOfLines={1}>
                  {cls.lecturer}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View className="flex-row items-center gap-1">
          <BellIcon color={swatch.ink} size={14} />
          <Text variant="caption" tone="inherit" style={ink}>
            {cls.reminderCount > 0 ? s.reminderCount(cls.reminderCount) : s.noReminders}
          </Text>
        </View>
        {progress !== null ? (
          <View
            className="mt-1 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: swatch.bar + '33' }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
                backgroundColor: swatch.bar,
              }}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

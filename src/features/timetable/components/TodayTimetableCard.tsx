import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useActiveTimetable, useNow } from '../hooks';
import { openTimetable } from '../navigation';
import { UpNextCard } from './UpNextCard';

const s = strings.today;

/** The timetable on the Today tab: what's on now or next, or an invitation to set it up. */
export function TodayTimetableCard() {
  const { colors } = useTheme();
  const { loading, classes } = useActiveTimetable();
  const now = useNow();
  if (loading) return null;
  if (classes.length === 0) {
    return (
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
            <CalendarClock color={colors['on-primary-soft']} size={22} />
          </View>
          <Text variant="heading" className="flex-1">
            {s.classTitle}
          </Text>
        </View>
        <Text tone="muted">{s.classSetup}</Text>
        <Button label={s.classSetupAction} variant="secondary" onPress={openTimetable} />
      </Card>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={s.classOpen}
      onPress={openTimetable}
      className="gap-2 active:opacity-90"
    >
      <UpNextCard classes={classes} now={now} size="small" />
      <View className="flex-row items-center justify-end gap-1 px-1">
        <Text variant="label" tone="primary">
          {s.classOpen}
        </Text>
        <ChevronRight color={colors.primary} size={16} />
      </View>
    </Pressable>
  );
}

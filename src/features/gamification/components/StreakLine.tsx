import { format, parseISO } from 'date-fns';
import { Flame, Snowflake } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { addDays } from '@/lib/time';
import { useTheme } from '@/theme';

import { useStreak } from '../hooks';

const s = strings.streak;

/**
 * The streak for the XP card: days in a row, a gentle line about today, freezes held and the
 * longest streak. After a break it says how to bring the streak back (never a scolding).
 */
export function StreakLine() {
  const { colors } = useTheme();
  const { loading, streak, today } = useStreak();
  if (loading) return null;

  const frozeYesterday = streak.frozenDays.includes(addDays(today, -1));
  const repair = streak.repair;
  const status = repair
    ? s.repair(
        Math.max(0, repair.target - repair.earned),
        format(parseISO(repair.until), 'EEEE d MMM'),
        repair.lostStreak,
      )
    : streak.current === 0
      ? s.start
      : streak.todayCounted
        ? s.todayDone
        : frozeYesterday
          ? s.freezeUsed
          : s.atRisk;

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Flame color={streak.current > 0 ? colors.accent : colors['fg-muted']} size={20} />
        <Text variant="bodyStrong" className="flex-1">
          {streak.current > 0 ? s.label(streak.current) : s.none}
        </Text>
      </View>
      <Text variant="small" tone="muted">
        {status}
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          <Snowflake color={colors['fg-muted']} size={16} />
          <Text variant="small" tone="muted">
            {s.freezes(streak.freezesHeld)}
          </Text>
        </View>
        {streak.longest > 0 ? (
          <Text variant="small" tone="muted">
            {s.longest(streak.longest)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

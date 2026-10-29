import { Star, Target } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useXpOverview } from '../hooks';

const s = strings.xp;

/**
 * The student's level (with its title and progress to the next) and today's daily goal. Shown at
 * the end of a review session and a quiz; the Today screen and Stats reuse it later.
 */
export function XpSummary() {
  const { colors } = useTheme();
  const { loading, level, goal, totalXp } = useXpOverview();
  if (loading) return null;

  const title = s.titles[level.title];
  return (
    <Card className="w-full gap-4">
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Star color={colors.accent} size={20} />
          <Text variant="bodyStrong" className="flex-1">
            {s.levelLabel(level.level, title)}
          </Text>
        </View>
        <ProgressBar
          value={level.fraction}
          tone="accent"
          accessibilityLabel={s.levelLabel(level.level, title)}
        />
        <Text variant="small" tone="muted">
          {level.maxed
            ? s.topLevel
            : s.toNextLevel(level.xpForNext - level.xpIntoLevel, level.level + 1)}
          {' · '}
          {s.totalXp(totalXp)}
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Target color={colors.primary} size={20} />
          <Text variant="bodyStrong" className="flex-1">
            {goal.goal > 0 ? s.goalProgress(goal.xp, goal.goal) : s.noGoal(goal.xp)}
          </Text>
        </View>
        {goal.goal > 0 ? (
          <ProgressBar
            value={goal.fraction}
            tone={goal.met ? 'success' : 'primary'}
            accessibilityLabel={s.goalLabel}
          />
        ) : null}
        {goal.goal > 0 ? (
          <Text variant="small" tone="muted">
            {goal.met ? s.goalMet : s.goalRemaining(goal.remaining)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

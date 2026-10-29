import { Flame, Sparkles, Star, Target } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Confetti, CountUp, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

import { isBigMoment, type Celebration } from '../celebration';
import { titleForLevel, xpRules } from '../logic';

const s = strings.celebrate;

/**
 * The reward at the end of a session: the XP earned counting up, and a line (with a little pop)
 * for each big moment: new level, daily goal, streak. Confetti falls on the big ones.
 */
export function CelebrationBanner({ celebration }: { celebration: Celebration }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0.6);
  const big = isBigMoment(celebration);

  useEffect(() => {
    if (big) haptic('celebrate');
    else if (celebration.xp > 0) haptic('success');
    if (!reduceMotion) pop.value = withSequence(withTiming(0.6, { duration: 0 }), withSpring(1));
    // Plays once, when the banner first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  if (celebration.xp <= 0 && !big) return null;

  const lines: { key: string; icon: typeof Flame; colour: string; text: string }[] = [];
  if (celebration.levelUp) {
    const title = strings.xp.titles[titleForLevel(celebration.levelUp.to)];
    lines.push({
      key: 'level',
      icon: Star,
      colour: colors.accent,
      text: strings.xp.levelUpToast(celebration.levelUp.to, title),
    });
  }
  if (celebration.goalReached) {
    lines.push({
      key: 'goal',
      icon: Target,
      colour: colors.success,
      text: strings.xp.goalReachedToast(xpRules.daily_goal_bonus.amount),
    });
  }
  if (celebration.streakRepaired && celebration.streakDays !== null) {
    lines.push({
      key: 'repair',
      icon: Flame,
      colour: colors.accent,
      text: strings.streak.repairedToast(celebration.streakDays),
    });
  } else if (celebration.streakExtended && celebration.streakDays !== null) {
    lines.push({
      key: 'streak',
      icon: Flame,
      colour: colors.accent,
      text:
        celebration.streakDays <= 1
          ? strings.streak.startedToast
          : strings.streak.extendedToast(celebration.streakDays),
    });
  }

  return (
    <View className="w-full items-center gap-3" testID="celebration">
      {big ? <Confetti height={320} /> : null}
      {celebration.xp > 0 ? (
        <Animated.View style={popStyle} className="items-center">
          <View className="flex-row items-center gap-2">
            <Sparkles color={colors.accent} size={24} />
            <CountUp variant="title" value={celebration.xp} format={s.xpEarned} />
          </View>
        </Animated.View>
      ) : null}
      {lines.map((line) => (
        <Animated.View
          key={line.key}
          style={popStyle}
          accessibilityLiveRegion="polite"
          className="w-full flex-row items-center gap-2 rounded-lg bg-accent-soft px-3 py-3"
        >
          <line.icon color={line.colour} size={22} />
          <Text variant="bodyStrong" tone="inherit" className="flex-1 text-on-accent-soft">
            {line.text}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

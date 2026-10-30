import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { cn } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { doziArt } from '../art/moods';
import { doziMoods, type DoziMood } from '../moods';

export { doziMoods, type DoziMood };

export type DoziProps = {
  mood?: DoziMood;
  /** Width and height in dp. */
  size?: number;
  className?: string;
  /** The small idle bounce. Off for a still picture. It is also off when the phone asks for less motion. */
  animated?: boolean;
};

/** How high (as a share of the size) and how fast Dozi bounces, per mood. */
const bounce: Record<DoziMood, { rise: number; ms: number }> = {
  idle: { rise: 0.025, ms: 900 },
  happy: { rise: 0.03, ms: 700 },
  celebrating: { rise: 0.07, ms: 380 },
  thinking: { rise: 0.012, ms: 1400 },
  encouraging: { rise: 0.03, ms: 800 },
  concerned: { rise: 0.012, ms: 1200 },
  sleepy: { rise: 0.01, ms: 1800 },
  studying: { rise: 0.012, ms: 1400 },
  proud: { rise: 0.025, ms: 900 },
  surprised: { rise: 0.05, ms: 450 },
};

/**
 * Monsieur Pierre, the tuxedo cat pharmacist, on a soft round badge. (The component keeps the
 * app's name, Dozi.) The drawing for each mood lives in
 * `art/` so finished artwork can replace it without touching this component.
 */
export function Dozi({ mood = 'idle', size = 96, className, animated = true }: DoziProps) {
  const Art = doziArt[mood];
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  const { rise, ms } = bounce[mood];

  useEffect(() => {
    if (!animated || reduceMotion) {
      cancelAnimation(lift);
      lift.value = 0;
      return;
    }
    const up = -size * rise;
    lift.value = withRepeat(
      withSequence(withTiming(up, { duration: ms }), withTiming(0, { duration: ms })),
      -1,
    );
    return () => cancelAnimation(lift);
  }, [animated, reduceMotion, size, rise, ms, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={strings.mascot.label}
      testID={`dozi-${mood}`}
      style={[{ width: size, height: size }, style]}
      className={cn('overflow-hidden rounded-full bg-primary-soft', className)}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Art />
      </Svg>
    </Animated.View>
  );
}

import { useEffect, useState } from 'react';
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
import { courseSwatch } from '@/theme';

import { doziAnimations, doziFrames } from '../art/moods';
import { nextStep, stepDuration } from '../logic';
import { doziMoods, type DoziMood } from '../moods';

export { doziMoods, type DoziMood };

export type DoziProps = {
  mood?: DoziMood;
  /** Width and height in dp. */
  size?: number;
  className?: string;
  /**
   * Pierre's mood loop (blinking, grinding, reading…) and a small bounce. Off for a still picture.
   * It is also off when the phone asks for less motion.
   */
  animated?: boolean;
};

/** How high (as a share of the size) and how fast Dozi bounces, per mood. */
/** Pierre's sticker: the light teal pastel in both themes. */
const stickerFill = courseSwatch('light', 'teal').fill;

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
 * `art/` so finished artwork can replace it without touching this component. Each mood plays a short
 * pixel-art loop, like his animations in the developer's other projects.
 */
export function Dozi({ mood = 'idle', size = 96, className, animated = true }: DoziProps) {
  const reduceMotion = useReducedMotion();
  const playing = animated && !reduceMotion;
  const step = useMoodLoop(mood, playing);
  const loop = doziAnimations[mood];
  const Art = doziFrames[loop.frames[step] ?? loop.frames[0]];
  const lift = useSharedValue(0);
  const { rise, ms } = bounce[mood];

  useEffect(() => {
    if (!playing) {
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
  }, [playing, size, rise, ms, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={strings.mascot.label}
      testID={`dozi-${mood}`}
      // A pale sticker with an ink ring, in both themes, so Pierre's black fur always shows.
      style={[{ width: size, height: size, backgroundColor: stickerFill }, style]}
      className={cn('overflow-hidden rounded-full border-2 border-outline', className)}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Art />
      </Svg>
    </Animated.View>
  );
}

/** Steps through the mood's frames on a timer; stays on the first (still) frame when not playing. */
function useMoodLoop(mood: DoziMood, playing: boolean): number {
  const [state, setState] = useState({ mood, step: 0 });
  const step = state.mood === mood ? state.step : 0;

  useEffect(() => {
    if (!playing) return;
    const loop = doziAnimations[mood];
    if (loop.frames.length <= 1) return;
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(
        () => {
          current = nextStep(loop, current);
          setState({ mood, step: current });
          tick();
        },
        stepDuration(loop, current),
      );
    };
    tick();
    return () => clearTimeout(timer);
  }, [mood, playing]);

  return playing ? step : 0;
}

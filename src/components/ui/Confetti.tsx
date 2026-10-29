import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { confettiPieces, type ConfettiPiece } from './logic';

export type ConfettiProps = {
  /** Pieces to drop. Keep it small on low-end phones. */
  count?: number;
  /** Changing this plays the burst again. */
  seed?: number;
  /** Height of the area the pieces fall through, in dp. */
  height?: number;
};

/**
 * A short burst of confetti falling over the top of its parent (task 2.5). Plain Reanimated
 * views, no extra library; about 24 small squares. It is decorative: hidden from screen readers,
 * ignores touches, and doesn't play when the phone asks for less motion.
 */
export function Confetti({ count = 24, seed = 1, height = 360 }: ConfettiProps) {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo(() => confettiPieces(count, seed), [count, seed]);
  if (reduceMotion) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="confetti"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}
    >
      {pieces.map((piece, i) => (
        <Piece key={`${seed}-${i}`} piece={piece} height={height} />
      ))}
    </View>
  );
}

function Piece({ piece, height }: { piece: ConfettiPiece; height: number }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const palette = [colors.primary, colors.accent, colors.success, colors.danger];
  const colour = palette[piece.colour % palette.length];

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(piece.delay, withTiming(1, { duration: piece.duration }));
  }, [piece, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.8 ? 1 : (1 - progress.value) / 0.2,
    transform: [
      { translateY: -20 + progress.value * (height + 20) },
      { translateX: progress.value * piece.drift * 300 },
      { rotate: `${progress.value * piece.turns * 360}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${piece.x * 100}%`,
          top: 0,
          width: piece.size,
          height: piece.size * 0.6,
          backgroundColor: colour,
          borderRadius: 1,
          opacity: 0,
        },
        style,
      ]}
    />
  );
}

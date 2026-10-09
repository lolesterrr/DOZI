import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Corner radius in dp. Use height / 2 for a circle. */
  radius?: number;
};

/** Grey placeholder that gently pulses while content loads (static if reduce motion is on). */
export function Skeleton({ width = '100%', height = 16, radius = 8 }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, overflow: 'hidden' }, animatedStyle]}
    >
      <View className="flex-1 bg-surface-muted" />
    </Animated.View>
  );
}

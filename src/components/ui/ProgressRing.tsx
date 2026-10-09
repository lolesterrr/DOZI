import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme, type ColorName } from '@/theme';

import { ringGeometry, toPercent } from './logic';

export type ProgressRingProps = {
  /** 0…1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: Extract<ColorName, 'primary' | 'accent' | 'success'>;
  /** Shown in the middle, e.g. <Text>3/5</Text>. */
  children?: ReactNode;
  accessibilityLabel?: string;
};

export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 8,
  tone = 'primary',
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const { radius, center, circumference, dashOffset } = ringGeometry(size, strokeWidth, value);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: toPercent(value) }}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors['surface-muted']}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Skipped at 0 so the round line cap doesn't draw a dot. */}
        {dashOffset < circumference ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors[tone]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            fill="none"
            // Start at 12 o'clock instead of 3 o'clock.
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

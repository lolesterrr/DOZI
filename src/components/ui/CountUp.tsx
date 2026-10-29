import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { countUpValue } from './logic';
import { Text, type TextProps } from './Text';

export type CountUpProps = Omit<TextProps, 'children'> & {
  value: number;
  durationMs?: number;
  /** Turns the number into words, e.g. `(n) => `+${n} XP``. */
  format?: (value: number) => string;
};

/**
 * A number that counts up from 0 to `value` (the XP count on the session-end screen). It shows the
 * final number straight away when the phone asks for less motion. Screen readers always get the
 * final number.
 */
export function CountUp({ value, durationMs = 900, format, ...rest }: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion && value > 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!animate) return undefined;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = (Date.now() - start) / durationMs;
      setShown(countUpValue(0, value, progress));
      if (progress >= 1) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [animate, value, durationMs]);

  const text = (n: number) => (format ? format(n) : String(n));
  return (
    <Text accessibilityLabel={text(value)} {...rest}>
      {text(animate ? shown : value)}
    </Text>
  );
}

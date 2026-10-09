import { View } from 'react-native';

import { cn, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

// PRODUCT_SPEC §9 — Dozi's expressions. Only the names exist for now: every mood shows the same
// placeholder until the real (original) artwork arrives in Phase 2.
export const doziMoods = [
  'idle',
  'happy',
  'celebrating',
  'thinking',
  'encouraging',
  'concerned',
  'sleepy',
  'studying',
  'proud',
  'surprised',
] as const;
export type DoziMood = (typeof doziMoods)[number];

export type DoziProps = {
  mood?: DoziMood;
  /** Diameter in dp. */
  size?: number;
  className?: string;
};

/** Dozi the crane. A placeholder badge until the illustrations exist. */
export function Dozi({ mood = 'idle', size = 96, className }: DoziProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={strings.mascot.label}
      testID={`dozi-${mood}`}
      style={{ width: size, height: size }}
      className={cn('items-center justify-center rounded-full bg-primary-soft', className)}
    >
      <Text variant="heading" tone="inherit" className="text-on-primary-soft">
        {strings.mascot.name}
      </Text>
    </View>
  );
}

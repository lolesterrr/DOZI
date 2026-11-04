// Small drawing pieces for the doodle look (trial branch): wobbly icon blobs, the rings that
// "hang" one card from another, the top bar each tab draws, and section titles.
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { courseSwatch, useTextScale, type CourseColour } from '@/theme';

import { cn } from './cn';
import { Text } from './Text';

/**
 * Pastel fills for blobs and tiles. They reuse the timetable's AA-checked course colours. Blobs
 * always use the light-mode pastels, in dark mode too: small bright "stickers" on a dark screen
 * read well, while dark pastels fade into the card.
 */
export type DoodleTint = CourseColour;

/** Rotations and corner shapes, picked by index so neighbouring blobs never look the same. */
const wobbles: { rotate: string; radius: ViewStyle }[] = [
  {
    rotate: '-6deg',
    radius: {
      borderTopLeftRadius: 22,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 20,
      borderBottomLeftRadius: 14,
    },
  },
  {
    rotate: '4deg',
    radius: {
      borderTopLeftRadius: 15,
      borderTopRightRadius: 22,
      borderBottomRightRadius: 14,
      borderBottomLeftRadius: 21,
    },
  },
  {
    rotate: '-3deg',
    radius: {
      borderTopLeftRadius: 19,
      borderTopRightRadius: 14,
      borderBottomRightRadius: 23,
      borderBottomLeftRadius: 17,
    },
  },
  {
    rotate: '6deg',
    radius: {
      borderTopLeftRadius: 14,
      borderTopRightRadius: 20,
      borderBottomRightRadius: 16,
      borderBottomLeftRadius: 22,
    },
  },
];

/** A hand-drawn-looking icon holder: outlined, slightly tilted, filled with a pastel tint. */
export function Blob({
  icon: Icon,
  tint = 'teal',
  index = 0,
  size = 48,
}: {
  icon: LucideIcon;
  tint?: DoodleTint;
  /** Picks the tilt and shape; pass the item's position in its list. */
  index?: number;
  size?: number;
}) {
  const swatch = courseSwatch('light', tint);
  const wobble = wobbles[Math.abs(index) % wobbles.length];
  return (
    <View
      className="items-center justify-center border-2 border-outline"
      style={[
        wobble.radius,
        {
          width: size,
          height: size * 0.9,
          backgroundColor: swatch.fill,
          transform: [{ rotate: wobble.rotate }],
        },
      ]}
    >
      <Icon color={swatch.ink} size={Math.round(size * 0.46)} />
    </View>
  );
}

/** The ring-on-a-stick that hangs a card from the one above. Put it inside a card's wrapper. */
export function Hanger({ left = '50%' }: { left?: `${number}%` }) {
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      className="absolute -top-[18px] z-10 items-center"
      style={{ left, marginLeft: -6 }}
    >
      <View className="h-3 w-3 rounded-full border-2 border-outline bg-surface" />
      <View className="h-[14px] w-[2px] bg-outline" />
    </View>
  );
}

/**
 * The top bar of each tab: a square button on the left, the title in the middle, a square button
 * on the right. It sits under the status bar (it adds the top safe-area inset itself).
 */
export function ScreenHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center gap-3 bg-background px-4 pb-2"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="min-w-touch items-start">{left}</View>
      <Text variant="heading" accessibilityRole="header" className="flex-1 text-center">
        {title}
      </Text>
      <View className="min-w-touch flex-row items-center justify-end gap-2">{right}</View>
    </View>
  );
}

/** A section title with an optional small control on the right. */
export function SectionTitle({
  title,
  right,
  className,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('flex-row items-center justify-between gap-2', className)}>
      <Text variant="heading" accessibilityRole="header" className="flex-1">
        {title}
      </Text>
      {right}
    </View>
  );
}

/** Text size (phone setting × the app's own setting) above which grids drop to one column. */
export const ONE_COLUMN_TEXT_SCALE = 1.15;

/** True when the text is big enough that two tiles side by side would cut their titles off. */
export function useOneColumn(): boolean {
  const { fontScale } = useWindowDimensions();
  return fontScale * useTextScale() > ONE_COLUMN_TEXT_SCALE;
}

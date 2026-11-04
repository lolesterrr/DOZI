import { Pressable, View } from 'react-native';

import { cn, Text } from '@/components/ui';
import type { LibraryItemType } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { doodleLayer, useTheme } from '@/theme';

import { librarySegments } from '../logic';

/**
 * Notes · Decks · Quizzes as one outlined doodle switch. The chosen one is an orange,
 * outlined block with bold text, so it doesn't rely on colour alone.
 */
export function Segments({
  value,
  onChange,
}: {
  value: LibraryItemType;
  onChange: (kind: LibraryItemType) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="px-4">
      <View
        accessibilityRole="tablist"
        accessibilityLabel={strings.library.segmentsLabel}
        className="flex-row gap-1 rounded-[20px] border-2 border-outline bg-surface p-1"
        style={doodleLayer(colors, 'ink', 6)}
      >
        {librarySegments.map((kind) => {
          const selected = kind === value;
          return (
            <Pressable
              key={kind}
              accessibilityRole="tab"
              accessibilityLabel={strings.library.segments[kind]}
              accessibilityState={{ selected }}
              onPress={() => onChange(kind)}
              className={cn(
                'min-h-touch flex-1 items-center justify-center rounded-2xl border-2 px-2',
                selected ? 'border-outline bg-accent' : 'border-transparent bg-transparent',
              )}
            >
              <Text
                variant={selected ? 'bodyStrong' : 'label'}
                tone="inherit"
                className={selected ? 'text-on-accent' : 'text-fg-muted'}
              >
                {strings.library.segments[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

import { View } from 'react-native';

import { Text } from '@/components/ui';
import type { Tag } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { tagColourTokens } from '../logic';

/** A small coloured label showing a tag's name (the name is always shown, never colour alone). */
export function TagPill({ tag }: { tag: Pick<Tag, 'name' | 'colour'> }) {
  const { colors } = useTheme();
  const tokens = tagColourTokens[tag.colour];
  return (
    <View
      accessibilityLabel={strings.library.tagLabel(tag.name)}
      style={{ backgroundColor: colors[tokens.bg] }}
      className="self-start rounded-full px-2.5 py-0.5"
    >
      <Text variant="caption" tone="inherit" style={{ color: colors[tokens.fg] }}>
        {tag.name}
      </Text>
    </View>
  );
}

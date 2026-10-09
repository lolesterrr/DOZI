import { View } from 'react-native';

import { Chip } from '@/components/ui';
import type { LibraryItemType } from '@/db/schema';
import { strings } from '@/i18n/strings';

import { librarySegments } from '../logic';

/** Notes · Decks · Quizzes. The chosen one shows a tick as well as a colour. */
export function Segments({
  value,
  onChange,
}: {
  value: LibraryItemType;
  onChange: (kind: LibraryItemType) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={strings.library.segmentsLabel}
      className="flex-row flex-wrap gap-2 px-4"
    >
      {librarySegments.map((kind) => (
        <Chip
          key={kind}
          accessibilityRole="tab"
          label={strings.library.segments[kind]}
          selected={kind === value}
          onPress={() => onChange(kind)}
        />
      ))}
    </View>
  );
}

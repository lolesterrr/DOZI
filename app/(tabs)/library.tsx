import { useState } from 'react';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ui';
import type { LibraryItemType } from '@/db/schema';
import { LibraryBrowser, Segments } from '@/features/library';
import { CreateButton, HeaderSearchButton } from '@/features/shell';
import { strings } from '@/i18n/strings';

// Library tab: the student's notes, decks and quizzes, in folders and with tags (PRODUCT_SPEC §4).
export default function LibraryScreen() {
  const [kind, setKind] = useState<LibraryItemType>('note');
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={strings.tabs.library} right={<HeaderSearchButton />} />
      {/* key: a fresh browser (and tag filter) for each segment. */}
      <LibraryBrowser
        key={kind}
        kind={kind}
        folderId={null}
        header={<Segments value={kind} onChange={setKind} />}
      />
      <CreateButton />
    </View>
  );
}

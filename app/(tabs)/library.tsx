import { useState } from 'react';
import { View } from 'react-native';

import type { LibraryItemType } from '@/db/schema';
import { LibraryBrowser, Segments } from '@/features/library';
import { CreateButton } from '@/features/shell';

// Library tab: the student's notes, decks and quizzes, in folders and with tags (PRODUCT_SPEC §4).
export default function LibraryScreen() {
  const [kind, setKind] = useState<LibraryItemType>('note');
  return (
    <View className="flex-1 bg-background">
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

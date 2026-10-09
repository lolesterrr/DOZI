import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FolderX } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { Breadcrumb, folderPath, LibraryBrowser, useFolder, useFolders } from '@/features/library';
import { strings } from '@/i18n/strings';

// One folder in the Library: its subfolders and items. Opened from the Library tab.
export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { folder, loading } = useFolder(id);
  const folders = useFolders(folder?.kind ?? 'note');

  if (loading) return <View className="flex-1 bg-background" />;

  if (!folder || folder.deletedAt) {
    return (
      <View className="flex-1 justify-center bg-background">
        <Stack.Screen options={{ title: '' }} />
        <EmptyState
          icon={FolderX}
          title={strings.library.folderMissingTitle}
          message={strings.library.folderMissingMessage}
          actionLabel={strings.library.back}
          onAction={() => router.dismissTo('/library')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: folder.name }} />
      <LibraryBrowser
        kind={folder.kind}
        folderId={folder.id}
        header={<Breadcrumb path={folderPath(folders, folder.id)} />}
      />
    </View>
  );
}

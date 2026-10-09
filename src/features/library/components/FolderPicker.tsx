import { Folder as FolderIcon, Library } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { cn, Text } from '@/components/ui';
import type { Folder } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { folderTree } from '../logic';

export type FolderPickerProps = {
  folders: readonly Folder[];
  /** Where the thing being moved is now (null = top level); shown but not tappable. */
  currentParentId: string | null;
  /** When moving a folder: it and its subfolders can't be picked. */
  movingFolderId?: string;
  onPick: (folderId: string | null) => void;
};

/** "Move to…": the top level plus every folder, indented to show nesting. */
export function FolderPicker({
  folders,
  currentParentId,
  movingFolderId,
  onPick,
}: FolderPickerProps) {
  const rows = folderTree(folders, movingFolderId);
  return (
    <ScrollView style={{ maxHeight: 420 }} contentContainerClassName="pb-2">
      <PickerRow
        label={strings.library.topLevel}
        depth={0}
        top
        current={currentParentId === null}
        onPress={() => onPick(null)}
      />
      {rows.map(({ folder, depth }) => (
        <PickerRow
          key={folder.id}
          label={folder.name}
          depth={depth + 1}
          current={folder.id === currentParentId}
          onPress={() => onPick(folder.id)}
        />
      ))}
    </ScrollView>
  );
}

function PickerRow({
  label,
  depth,
  current,
  top,
  onPress,
}: {
  label: string;
  depth: number;
  current: boolean;
  top?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const Icon = top ? Library : FolderIcon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={current ? `${label}, ${strings.library.moveHere}` : label}
      accessibilityState={{ disabled: current }}
      disabled={current}
      onPress={onPress}
      style={{ paddingLeft: 8 + Math.min(depth, 6) * 20 }}
      className={cn(
        'min-h-touch flex-row items-center gap-3 rounded-md py-2.5 pr-2 active:bg-surface-muted',
        current && 'opacity-60',
      )}
    >
      <Icon color={colors.primary} size={20} />
      <Text className="flex-1" numberOfLines={1}>
        {label}
      </Text>
      {current ? (
        <View>
          <Text variant="caption" tone="muted">
            {strings.library.moveHere}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

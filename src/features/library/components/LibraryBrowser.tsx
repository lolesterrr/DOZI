import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  MoreVertical,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Tags,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BottomSheet, Button, Chip, EmptyState, IconButton, Text, useToast } from '@/components/ui';
import type { Folder, LibraryItemType, Tag } from '@/db/schema';
import { Dozi } from '@/features/mascot';
import { TemplatePicker } from '@/features/notes/components/TemplatePicker';
import type { NoteTemplate } from '@/features/notes/templates';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { useFolders, useLibraryActions, useLibraryItems, useLibrarySort, useTags } from '../hooks';
import {
  childFolders,
  filterByTags,
  folderNameProblem,
  keepExistingTags,
  librarySorts,
  sortEntries,
  sortItems,
  toggleId,
  type LibraryItem,
} from '../logic';
import { FolderPicker } from './FolderPicker';
import { NameForm, nameProblemMessage } from './NameForm';
import { SheetAction } from './SheetAction';
import { TagManager } from './TagManager';
import { TagPicker } from './TagPicker';
import { TagPill } from './TagPill';

const s = strings.library;
const log = createLogger('library');

type Row =
  | { type: 'folder'; key: string; folder: Folder; childCount: number }
  | { type: 'item'; key: string; item: LibraryItem };

type Sheet =
  | { type: 'sort' }
  | { type: 'tags' }
  | { type: 'newFolder' }
  | { type: 'folderActions'; folder: Folder }
  | { type: 'rename'; folder: Folder }
  | { type: 'move'; folder: Folder }
  | { type: 'itemActions'; item: LibraryItem }
  | { type: 'itemMove'; item: LibraryItem }
  | { type: 'itemTags'; item: LibraryItem }
  | { type: 'newNote' };

/** Opens a note, deck or quiz. Decks (1.6) and quizzes (1.10) add their screens. */
function openItem(item: LibraryItem) {
  if (item.type === 'note') router.push({ pathname: '/note/[id]', params: { id: item.id } });
}

export type LibraryBrowserProps = {
  kind: LibraryItemType;
  /** null = the top level of this segment. */
  folderId: string | null;
  /** Shown above the toolbar: the segment switcher, or the breadcrumb inside a folder. */
  header?: ReactNode;
};

/**
 * One level of the Library: its folders and items, with New folder, Sort, Tags and a tag filter.
 * Used by the Library tab (top level) and by each folder screen.
 */
export function LibraryBrowser({ kind, folderId, header }: LibraryBrowserProps) {
  const toast = useToast();
  const actions = useLibraryActions();
  const folders = useFolders(kind);
  const tags = useTags();
  const items = useLibraryItems(kind);
  const [sort, setSort] = useLibrarySort();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [tagSheetTitle, setTagSheetTitle] = useState<string>(s.manageTagsTitle);

  const activeTags = keepExistingTags(selectedTags, tags);
  const filtering = activeTags.length > 0;
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const rows = useMemo<Row[]>(() => {
    const itemRow = (item: LibraryItem): Row => ({ type: 'item', key: `i:${item.id}`, item });
    // A tag filter looks across every folder of this segment.
    if (filtering) return sortItems(filterByTags(items, activeTags), sort).map(itemRow);
    const folderRows = sortEntries(childFolders(folders, folderId), sort).map((folder): Row => ({
      type: 'folder',
      key: `f:${folder.id}`,
      folder,
      childCount: childFolders(folders, folder.id).length,
    }));
    const here = items.filter((i) => i.folderId === folderId);
    return [...folderRows, ...sortItems(here, sort).map(itemRow)];
  }, [filtering, items, activeTags, sort, folders, folderId]);

  const close = () => setSheet(null);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Library change failed', { error: String(error) });
      toast.show({ message: s.failed, tone: 'error' });
    }
  };

  const deleteFolder = (folder: Folder) =>
    run(async () => {
      close();
      const deleted = await actions.deleteFolder(folder.id);
      const inside = deleted.ids.length - 1;
      toast.show({
        message: inside > 0 ? s.deletedWithChildren(folder.name, inside) : s.deleted(folder.name),
        actionLabel: s.undo,
        onAction: () => void run(() => actions.restoreFolders(deleted)),
      });
    });

  const deleteTag = (tag: Tag) =>
    run(async () => {
      close();
      await actions.deleteTag(tag.id);
      toast.show({
        message: s.tagDeleted(tag.name),
        actionLabel: s.undo,
        onAction: () => void run(() => actions.restoreTag(tag.id)),
      });
    });

  const newNote = () => setSheet({ type: 'newNote' });

  const createNote = (template: NoteTemplate | null) =>
    run(async () => {
      close();
      const note = await actions.createNote(folderId, template);
      router.push({ pathname: '/note/[id]', params: { id: note.id } });
    });

  const deleteItem = (item: LibraryItem) =>
    run(async () => {
      close();
      await actions.deleteItem(item);
      toast.show({
        message: s.deleted(item.name),
        actionLabel: s.undo,
        onAction: () => void run(() => actions.restoreItem(item)),
      });
    });

  const validateFolderName = (parentId: string | null, ignoreId?: string) => (name: string) => {
    const problem = folderNameProblem(name, childFolders(folders, parentId), ignoreId);
    return problem ? nameProblemMessage(problem, 'folder') : null;
  };

  const sheetTitle = (() => {
    switch (sheet?.type) {
      case 'sort':
        return s.sortTitle;
      case 'tags':
        return tagSheetTitle;
      case 'newFolder':
        return s.newFolderTitle;
      case 'folderActions':
        return sheet.folder.name;
      case 'rename':
        return s.renameFolderTitle;
      case 'move':
        return s.moveTitle(sheet.folder.name);
      case 'itemActions':
        return sheet.item.name;
      case 'itemMove':
        return s.moveTitle(sheet.item.name);
      case 'itemTags':
        return s.itemTagsTitle(sheet.item.name);
      case 'newNote':
        return strings.notes.templateTitle;
      default:
        return '';
    }
  })();

  const listHeader = (
    <View className="gap-3 pb-2 pt-3">
      {header}
      <View className="flex-row flex-wrap gap-2 px-4">
        {kind === 'note' ? (
          <Button label={strings.notes.newNote} icon={NotebookPen} onPress={() => void newNote()} />
        ) : null}
        <Button
          label={s.newFolder}
          icon={FolderPlus}
          variant="secondary"
          onPress={() => setSheet({ type: 'newFolder' })}
        />
        <Button
          label={s.sorts[sort]}
          icon={ArrowUpDown}
          variant="outline"
          accessibilityLabel={`${s.sort}: ${s.sorts[sort]}`}
          onPress={() => setSheet({ type: 'sort' })}
        />
        <Button
          label={s.tags}
          icon={Tags}
          variant="outline"
          onPress={() => {
            setTagSheetTitle(s.manageTagsTitle);
            setSheet({ type: 'tags' });
          }}
        />
      </View>
      {tags.length > 0 ? (
        <View className="gap-1.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityLabel={s.filterLabel}
            contentContainerClassName="gap-2 px-4"
          >
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                selected={activeTags.includes(tag.id)}
                onPress={() => setSelectedTags((current) => toggleId(current, tag.id))}
              />
            ))}
            {filtering ? <Chip label={s.clearFilter} onPress={() => setSelectedTags([])} /> : null}
          </ScrollView>
          {filtering ? (
            <Text variant="small" tone="muted" className="px-4">
              {s.filterHint}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const empty = filtering ? (
    <EmptyState
      illustration={<Dozi mood="thinking" />}
      title={s.empty.filter.title}
      message={s.empty.filter.message}
      actionLabel={s.clearFilter}
      onAction={() => setSelectedTags([])}
    />
  ) : (
    <EmptyState
      illustration={<Dozi mood={folderId ? 'idle' : 'encouraging'} />}
      title={folderId ? s.empty.folder.title : s.empty[kind].title}
      message={folderId ? s.empty.folder.message : s.empty[kind].message}
      actionLabel={kind === 'note' ? strings.notes.newNote : s.newFolder}
      onAction={() => (kind === 'note' ? void newNote() : setSheet({ type: 'newFolder' }))}
    />
  );

  return (
    <View className="flex-1">
      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={({ item: row }) =>
          row.type === 'folder' ? (
            <FolderRow
              folder={row.folder}
              childCount={row.childCount}
              onOpen={() =>
                router.push({ pathname: '/folder/[id]', params: { id: row.folder.id } })
              }
              onMore={() => setSheet({ type: 'folderActions', folder: row.folder })}
            />
          ) : (
            <ItemRow
              item={row.item}
              tagsById={tagsById}
              onOpen={() => openItem(row.item)}
              onMore={() => setSheet({ type: 'itemActions', item: row.item })}
            />
          )
        }
      />

      <BottomSheet visible={sheet !== null} onClose={close} title={sheetTitle}>
        {sheet?.type === 'newNote' ? (
          <TemplatePicker onPick={(template) => void createNote(template)} />
        ) : null}

        {sheet?.type === 'sort' ? (
          <View className="pb-2">
            {librarySorts.map((option) => (
              <SortOption
                key={option}
                label={s.sorts[option]}
                selected={option === sort}
                onPress={() => {
                  setSort(option);
                  close();
                }}
              />
            ))}
          </View>
        ) : null}

        {sheet?.type === 'tags' ? (
          <TagManager
            tags={tags}
            onTitleChange={setTagSheetTitle}
            onCreate={(name, colour) => actions.createTag(name, colour)}
            onUpdate={(id, changes) => actions.updateTag(id, changes)}
            onDelete={(tag) => void deleteTag(tag)}
          />
        ) : null}

        {sheet?.type === 'newFolder' ? (
          <NameForm
            placeholder={s.folderPlaceholder}
            submitLabel={s.create}
            validate={validateFolderName(folderId)}
            onCancel={close}
            onSubmit={(name) =>
              run(async () => {
                const folder = await actions.createFolder(kind, name, folderId);
                close();
                toast.show({ message: s.created(folder.name), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet?.type === 'folderActions' ? (
          <View className="pb-2">
            <SheetAction
              icon={Pencil}
              label={s.actions.rename}
              onPress={() => setSheet({ type: 'rename', folder: sheet.folder })}
            />
            <SheetAction
              icon={FolderInput}
              label={s.actions.move}
              onPress={() => setSheet({ type: 'move', folder: sheet.folder })}
            />
            <SheetAction
              icon={Trash2}
              label={s.actions.delete}
              danger
              onPress={() => void deleteFolder(sheet.folder)}
            />
          </View>
        ) : null}

        {sheet?.type === 'rename' ? (
          <NameForm
            initialName={sheet.folder.name}
            placeholder={s.folderPlaceholder}
            submitLabel={s.save}
            validate={validateFolderName(sheet.folder.parentId ?? null, sheet.folder.id)}
            onCancel={close}
            onSubmit={(name) =>
              run(async () => {
                await actions.renameFolder(sheet.folder.id, name);
                close();
              })
            }
          />
        ) : null}

        {sheet?.type === 'move' ? (
          <FolderPicker
            folders={folders}
            currentParentId={sheet.folder.parentId ?? null}
            movingFolderId={sheet.folder.id}
            onPick={(parentId) =>
              void run(async () => {
                await actions.moveFolder(sheet.folder.id, parentId);
                close();
                toast.show({ message: s.moved(sheet.folder.name), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet?.type === 'itemActions' ? (
          <View className="pb-2">
            <SheetAction
              icon={sheet.item.pinned ? PinOff : Pin}
              label={sheet.item.pinned ? s.actions.unpin : s.actions.pin}
              onPress={() =>
                void run(async () => {
                  close();
                  await actions.setItemPinned(sheet.item, !sheet.item.pinned);
                })
              }
            />
            <SheetAction
              icon={FolderInput}
              label={s.actions.move}
              onPress={() => setSheet({ type: 'itemMove', item: sheet.item })}
            />
            <SheetAction
              icon={Tags}
              label={s.tags}
              onPress={() => setSheet({ type: 'itemTags', item: sheet.item })}
            />
            <SheetAction
              icon={Trash2}
              label={s.actions.delete}
              danger
              onPress={() => void deleteItem(sheet.item)}
            />
          </View>
        ) : null}

        {sheet?.type === 'itemMove' ? (
          <FolderPicker
            folders={folders}
            currentParentId={sheet.item.folderId}
            onPick={(target) =>
              void run(async () => {
                await actions.moveItem(sheet.item, target);
                close();
                toast.show({ message: s.moved(sheet.item.name), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet?.type === 'itemTags' ? (
          <View className="gap-3">
            <TagPicker
              tags={tags}
              selected={items.find((i) => i.id === sheet.item.id)?.tagIds ?? sheet.item.tagIds}
              onChange={(tagIds) =>
                void run(() => actions.setItemTags(sheet.item.type, sheet.item.id, tagIds))
              }
              onCreate={(name) => actions.createTag(name, 'teal')}
            />
            <Button label={s.done} onPress={close} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function FolderRow({
  folder,
  childCount,
  onOpen,
  onMore,
}: {
  folder: Folder;
  childCount: number;
  onOpen: () => void;
  onMore: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="mx-4 mb-2 flex-row items-center rounded-lg border border-border bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.folderLabel(folder.name)}
        accessibilityHint={childCount > 0 ? s.folderCount(childCount) : undefined}
        onPress={onOpen}
        className="min-h-touch flex-1 flex-row items-center gap-3 py-3 pl-4 active:opacity-80"
      >
        <View className="h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
          <FolderIcon color={colors['on-accent-soft']} size={22} />
        </View>
        <View className="flex-1">
          <Text variant="bodyStrong" numberOfLines={2}>
            {folder.name}
          </Text>
          {childCount > 0 ? (
            <Text variant="small" tone="muted">
              {s.folderCount(childCount)}
            </Text>
          ) : null}
        </View>
        <ChevronRight color={colors['fg-muted']} size={20} />
      </Pressable>
      <IconButton
        icon={MoreVertical}
        accessibilityLabel={s.folderActions(folder.name)}
        onPress={onMore}
        className="mr-1"
      />
    </View>
  );
}

/** A note, deck or quiz: tap to open, ⋮ for Pin · Move · Tags · Delete. */
function ItemRow({
  item,
  tagsById,
  onOpen,
  onMore,
}: {
  item: LibraryItem;
  tagsById: Map<string, Tag>;
  onOpen: () => void;
  onMore: () => void;
}) {
  const { colors } = useTheme();
  const itemTags = item.tagIds.map((id) => tagsById.get(id)).filter((t): t is Tag => !!t);
  return (
    <View className="mx-4 mb-2 flex-row items-start rounded-lg border border-border bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.itemLabel(item.type, item.name)}
        accessibilityHint={item.pinned ? s.pinnedHint : undefined}
        onPress={onOpen}
        className="min-h-touch flex-1 gap-1.5 py-3 pl-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-1.5">
          {item.pinned ? <Pin color={colors.primary} size={16} /> : null}
          <Text variant="bodyStrong" numberOfLines={2} className="flex-1">
            {item.name}
          </Text>
        </View>
        {item.preview ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {item.preview}
          </Text>
        ) : null}
        {itemTags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {itemTags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </View>
        ) : null}
      </Pressable>
      <IconButton
        icon={MoreVertical}
        accessibilityLabel={s.folderActions(item.name)}
        onPress={onMore}
        className="mr-1 mt-1"
      />
    </View>
  );
}

function SortOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-touch flex-row items-center gap-3 rounded-md px-2 py-3 active:bg-surface-muted"
    >
      <Text variant={selected ? 'bodyStrong' : 'body'} className="flex-1">
        {label}
      </Text>
      {selected ? <Check color={colors.primary} size={20} /> : null}
    </Pressable>
  );
}

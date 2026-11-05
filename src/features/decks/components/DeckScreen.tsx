import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Brain,
  FileDown,
  FileUp,
  FileX,
  FolderInput,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  Settings2,
  Tags,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Blob,
  BottomSheet,
  Button,
  Card as CoverCard,
  Chip,
  EmptyState,
  IconButton,
  SelectionBar,
  SelectMark,
  Text,
  useSelection,
  useToast,
  waitForSheetToClose,
} from '@/components/ui';
import type { Card, Deck } from '@/db/schema';
import { CsvImportPanel } from '@/features/export/components/CsvImportPanel';
import { useTransferActions } from '@/features/export/hooks';
import { exportToast } from '@/features/export/messages';
import { FolderPicker } from '@/features/library/components/FolderPicker';
import { kindIcons, kindTints } from '@/features/library/kinds';
import { NameForm } from '@/features/library/components/NameForm';
import { SheetAction } from '@/features/library/components/SheetAction';
import { TagPicker } from '@/features/library/components/TagPicker';
import { useFolders, useItemTagMap, useLibraryActions, useTags } from '@/features/library/hooks';
import { Dozi } from '@/features/mascot';
import { useDueCount } from '@/features/review/hooks';
import { openReview } from '@/features/review/navigation';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useDeck, useDeckActions, useDeckCards } from '../hooks';
import {
  deckTags,
  docToField,
  filterCardsByTag,
  liveTagFilter,
  parseCardTags,
  tagUse,
  type DeckTag,
} from '../logic';
import { deckTitleMessage } from '../messages';
import { openCardEditor } from '../navigation';
import { CardTagPicker } from './CardTagPicker';
import { DeckSettingsForm } from './DeckSettingsForm';

const s = strings.decks;
const sel = strings.selection;
const log = createLogger('decks');

function backToLibrary() {
  if (router.canGoBack()) router.back();
  else router.replace('/library');
}

/** The deck screen: loads the deck, then shows its cards (or why it can't). */
export function DeckScreen({ id }: { id: string }) {
  const { deck, loading } = useDeck(id);
  const insets = useSafeAreaInsets();
  if (loading) return <View className="flex-1 bg-background" />;
  if (!deck || deck.deletedAt) {
    return (
      <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={FileX}
          title={s.missingTitle}
          message={s.missingMessage}
          actionLabel={s.back}
          onAction={backToLibrary}
        />
      </View>
    );
  }
  return <DeckDetail deck={deck} />;
}

type Sheet = 'actions' | 'rename' | 'settings' | 'move' | 'tags' | 'import' | 'cardTags';

function DeckDetail({ deck }: { deck: Deck }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const actions = useDeckActions();
  const library = useLibraryActions();
  const transfer = useTransferActions();
  const [exporting, setExporting] = useState(false);
  const allCards = useDeckCards(deck.id);
  // Card tags (they stay in this deck): filter the list by one of them.
  const cardTags = useMemo(() => deckTags(allCards), [allCards]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const activeTag = liveTagFilter(tagFilter, cardTags);
  const cards = useMemo(() => filterCardsByTag(allCards, activeTag), [allCards, activeTag]);
  // Long press a card to pick several, then delete or tag them together.
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const selection = useSelection(cardIds);
  // Re-counted when the deck changes (cards added or edited, settings saved) and on coming back.
  const due = useDueCount({ deckId: deck.id }, deck.updatedAt);
  const folders = useFolders('deck');
  const tags = useTags();
  const tagMap = useItemTagMap('deck');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Deck change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const deleteDeck = () =>
    run(async () => {
      close();
      const deletedAt = await actions.deleteDeck(deck.id);
      backToLibrary();
      toast.show({
        message: s.deleted(deck.title),
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreDeck(deck.id, deletedAt)),
      });
    });

  const deleteSelectedCards = () => {
    const ids = selection.ids;
    if (ids.length === 0) return;
    const what = sel.cards(ids.length);
    Alert.alert(sel.confirmTitle(what), sel.confirmMessage, [
      { text: sel.keep, style: 'cancel' },
      {
        text: sel.deleteButton,
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            selection.clear();
            const deletedAt = await actions.deleteCards(ids);
            toast.show({
              message: sel.deleted(what),
              actionLabel: strings.library.undo,
              onAction: () => void run(() => actions.restoreCards(ids, deletedAt)),
            });
          }),
      },
    ]);
  };

  const selectedCards = useMemo(
    () => cards.filter((card) => selection.ids.includes(card.id)),
    [cards, selection.ids],
  );

  const tagSelectedCards = (name: string, action: 'add' | 'remove') =>
    run(async () => {
      const ids = selectedCards.map((card) => card.id);
      const changes = await actions.changeCardsTag(ids, name, action);
      if (changes.length === 0) {
        toast.show({ message: s.cardTags.unchanged });
        return;
      }
      toast.show({
        message:
          action === 'add'
            ? s.cardTags.added(name, changes.length)
            : s.cardTags.removed(name, changes.length),
        tone: 'success',
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreCardTags(changes)),
      });
    });

  const exportCsv = () =>
    run(async () => {
      close();
      setExporting(true);
      try {
        await waitForSheetToClose();
        const message = exportToast(await transfer.exportDeckCsv(deck.id, deck.title));
        if (message) toast.show(message);
      } finally {
        setExporting(false);
      }
    });

  const sheetTitle =
    sheet === 'import'
      ? strings.transfer.importTitle
      : sheet === 'rename'
        ? s.renameTitle
        : sheet === 'settings'
          ? s.settings.title
          : sheet === 'move'
            ? strings.library.moveTitle(deck.title)
            : sheet === 'tags'
              ? strings.library.itemTagsTitle(deck.title)
              : sheet === 'cardTags'
                ? s.cardTags.sheetTitle(selectedCards.length)
                : deck.title;

  const header = (
    <View className="gap-3 px-4 pb-3 pt-1">
      {/* The deck's "cover": a coral-layered card, the colour every deck has in the Library. */}
      <CoverCard layer={kindTints.deck} className="mb-1 gap-3">
        <View className="flex-row items-center gap-3">
          <Blob icon={kindIcons.deck} tint={kindTints.deck} index={1} size={52} />
          <Text variant="bodyStrong" className="flex-1" accessibilityLiveRegion="polite">
            {s.summary(allCards.length, due)}
          </Text>
        </View>
        {deck.description ? <Text variant="body">{deck.description}</Text> : null}
      </CoverCard>
      {cardTags.length > 0 ? (
        <TagFilter
          tags={cardTags}
          total={allCards.length}
          active={activeTag}
          onChange={(tag) => {
            selection.clear();
            setTagFilter(tag);
          }}
        />
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {activeTag ? (
          <Button
            label={s.cramTag(activeTag)}
            icon={Brain}
            disabled={cards.length === 0}
            onPress={() => openReview(deck.id, 'cram', activeTag)}
          />
        ) : allCards.length > 0 ? (
          <Button
            label={due ? s.studyCount(due) : s.study}
            icon={Play}
            disabled={!due}
            onPress={() => openReview(deck.id)}
          />
        ) : null}
        <Button
          label={s.addCards}
          icon={Plus}
          variant={allCards.length > 0 ? 'secondary' : 'primary'}
          onPress={() => openCardEditor(deck.id, 'new', undefined, activeTag)}
        />
        <Button
          label={s.actions.settings}
          icon={Settings2}
          variant="outline"
          onPress={() => setSheet('settings')}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
        <IconButton
          icon={ArrowLeft}
          variant="soft"
          accessibilityLabel={s.back}
          onPress={backToLibrary}
        />
        <Text variant="heading" numberOfLines={2} className="flex-1">
          {deck.title}
        </Text>
        <IconButton
          variant="soft"
          icon={MoreVertical}
          accessibilityLabel={s.moreOptions}
          onPress={() => setSheet('actions')}
        />
      </View>
      <SelectionBar
        selection={selection}
        onDelete={deleteSelectedCards}
        onTag={() => setSheet('cardTags')}
      />

      <FlashList
        data={cards}
        extraData={selection.ids}
        keyExtractor={(card) => card.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            illustration={<Dozi mood="encouraging" />}
            title={s.empty.title}
            message={s.empty.message}
            actionLabel={s.addCards}
            onAction={() => openCardEditor(deck.id, 'new')}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => (
          <CardRow
            card={item}
            selecting={selection.selecting}
            selected={selection.isSelected(item.id)}
            onPress={() =>
              selection.selecting ? selection.toggle(item.id) : openCardEditor(deck.id, item.id)
            }
            onLongPress={() => selection.begin(item.id)}
          />
        )}
      />

      <BottomSheet visible={sheet !== null} onClose={close} title={sheetTitle}>
        {sheet === 'actions' ? (
          <View className="pb-2">
            <SheetAction
              icon={deck.pinned ? PinOff : Pin}
              label={deck.pinned ? s.actions.unpin : s.actions.pin}
              onPress={() =>
                void run(async () => {
                  close();
                  await actions.setPinned(deck.id, !deck.pinned);
                })
              }
            />
            <SheetAction
              icon={Brain}
              label={s.cram}
              disabled={allCards.length === 0}
              onPress={() => {
                close();
                openReview(deck.id, 'cram');
              }}
            />
            <SheetAction
              icon={Pencil}
              label={s.actions.rename}
              onPress={() => setSheet('rename')}
            />
            <SheetAction
              icon={Settings2}
              label={s.actions.settings}
              onPress={() => setSheet('settings')}
            />
            <SheetAction
              icon={FolderInput}
              label={s.actions.move}
              onPress={() => setSheet('move')}
            />
            <SheetAction icon={Tags} label={s.actions.tags} onPress={() => setSheet('tags')} />
            <SheetAction
              icon={FileUp}
              label={strings.transfer.importCsv}
              onPress={() => setSheet('import')}
            />
            <SheetAction
              icon={FileDown}
              label={strings.transfer.exportCsv}
              disabled={allCards.length === 0 || exporting}
              onPress={() => void exportCsv()}
            />
            <SheetAction
              icon={Trash2}
              label={s.actions.delete}
              danger
              onPress={() => void deleteDeck()}
            />
          </View>
        ) : null}

        {sheet === 'import' ? (
          <CsvImportPanel
            deckId={deck.id}
            onCancel={close}
            onImport={async (plan) => {
              try {
                const imported = await transfer.importCsv(deck.id, plan);
                close();
                const added = imported.cardIds.length;
                const retagged = imported.retagged.length;
                if (added === 0 && retagged === 0) {
                  toast.show({ message: strings.transfer.nothingNew });
                  return;
                }
                toast.show({
                  message:
                    retagged === 0
                      ? strings.transfer.imported(added)
                      : added === 0
                        ? strings.transfer.retagged(retagged)
                        : strings.transfer.importedAndRetagged(added, retagged),
                  tone: 'success',
                  actionLabel: strings.transfer.undo,
                  onAction: () => void run(() => transfer.undoImport(deck.id, imported)),
                });
              } catch (error) {
                log.warn('CSV import failed', { error: String(error) });
                toast.show({ message: strings.transfer.failed, tone: 'error' });
                throw error;
              }
            }}
          />
        ) : null}

        {sheet === 'rename' ? (
          <NameForm
            initialName={deck.title}
            placeholder={s.titlePlaceholder}
            submitLabel={strings.library.save}
            validate={deckTitleMessage}
            onCancel={close}
            onSubmit={(title) =>
              run(async () => {
                await actions.renameDeck(deck.id, title);
                close();
              })
            }
          />
        ) : null}

        {sheet === 'settings' ? (
          <DeckSettingsForm
            deck={deck}
            onCancel={close}
            onSave={(settings) =>
              run(async () => {
                await actions.updateSettings(deck.id, settings);
                close();
                toast.show({ message: s.settings.saved, tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet === 'move' ? (
          <FolderPicker
            folders={folders}
            currentParentId={deck.folderId ?? null}
            onPick={(folderId) =>
              void run(async () => {
                await actions.moveDeck(deck.id, folderId);
                close();
                toast.show({ message: strings.library.moved(deck.title), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet === 'tags' ? (
          <View className="gap-3">
            <TagPicker
              tags={tags}
              selected={tagMap.get(deck.id) ?? []}
              onChange={(tagIds) => void run(() => library.setItemTags('deck', deck.id, tagIds))}
              onCreate={(name) => library.createTag(name, 'teal')}
            />
            <Button label={strings.library.done} onPress={close} />
          </View>
        ) : null}

        {sheet === 'cardTags' ? (
          <View className="gap-3 pb-2">
            <Text variant="small" tone="muted">
              {s.cardTags.sheetHelp}
            </Text>
            <CardTagPicker
              options={cardTags.map((tag) => ({
                name: tag.name,
                use: tagUse(selectedCards, tag.name),
              }))}
              onToggle={(name, use) =>
                void tagSelectedCards(name, use === 'all' ? 'remove' : 'add')
              }
              onAdd={(name) => void tagSelectedCards(name, 'add')}
            />
            <Button label={strings.library.done} onPress={close} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

/** One card in the deck list: its type, the start of the front and of the back. */
function CardRow({
  card,
  selecting,
  selected,
  onPress,
  onLongPress,
}: {
  card: Card;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const front = firstLine(card.frontText) || imageOnly(card.frontJson);
  const back = firstLine(card.backText);
  const tags = parseCardTags(card.tagsJson);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.cardActions(front)}
      accessibilityState={selecting ? { selected } : undefined}
      accessibilityHint={selecting ? (selected ? sel.selected : sel.notSelected) : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      className={
        selected
          ? 'mx-4 mb-2 min-h-touch flex-row items-center gap-3 rounded-[20px] border-4 border-primary bg-primary-soft px-4 py-3 active:opacity-80'
          : 'mx-4 mb-2 min-h-touch flex-row items-center gap-3 rounded-[20px] border-2 border-outline bg-surface px-4 py-3 active:opacity-80'
      }
    >
      <View className="flex-1 gap-1">
        <Text variant="caption" tone="muted">
          {strings.cards.types[card.type]}
          {card.suspended ? ` · ${s.suspendedLabel}` : ''}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {front}
        </Text>
        {back ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {back}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {s.cardTags.list(tags.join(' · '))}
          </Text>
        ) : null}
      </View>
      {selecting ? <SelectMark selected={selected} /> : null}
    </Pressable>
  );
}

/** The deck's card tags as a row of chips: All, then each tag with its number of cards. */
function TagFilter({
  tags,
  total,
  active,
  onChange,
}: {
  tags: readonly DeckTag[];
  total: number;
  active: string | null;
  onChange: (tag: string | null) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="label">{s.cardTags.filterLabel}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 pr-4"
        accessibilityRole="radiogroup"
      >
        <Chip
          label={s.cardTags.all(total)}
          selected={active === null}
          accessibilityRole="radio"
          onPress={() => onChange(null)}
        />
        {tags.map((tag) => (
          <Chip
            key={tag.name}
            label={s.cardTags.tag(tag.name, tag.count)}
            selected={active === tag.name}
            accessibilityRole="radio"
            onPress={() => onChange(active === tag.name ? null : tag.name)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .find((line) => line.trim() !== '')
      ?.trim() ?? ''
  );
}

function imageOnly(frontJson: string): string {
  return docToField(frontJson).mediaIds.length > 0 ? strings.media.imageLabel : '';
}

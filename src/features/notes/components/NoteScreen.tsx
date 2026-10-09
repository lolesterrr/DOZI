import { useKeyboard } from '@10play/tentap-editor';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  FileX,
  FolderInput,
  History,
  Images,
  MoreVertical,
  Pin,
  PinOff,
  Tags,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, EmptyState, IconButton, Text, useToast } from '@/components/ui';
import type { Note, NoteVersion } from '@/db/schema';
import { FolderPicker } from '@/features/library/components/FolderPicker';
import { SheetAction } from '@/features/library/components/SheetAction';
import { TagPicker } from '@/features/library/components/TagPicker';
import { useFolders, useItemTagMap, useLibraryActions, useTags } from '@/features/library/hooks';
import { useAddImage } from '@/features/media/hooks';
import { mediaRef } from '@/features/media/logic';
import type { ImageSourceKind } from '@/features/media/pipeline';
import { useProfile } from '@/features/profile/hooks';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { EditorToolbar } from '../editor/EditorToolbar';
import { NoteEditorView, useNoteEditor } from '../editor/NoteEditor';
import {
  useDebouncedSave,
  useNote,
  useNoteActions,
  useNoteAutosave,
  useNoteVersions,
} from '../hooks';
import {
  AUTOSAVE_DELAY_MS,
  countWords,
  docToText,
  formatVersionTime,
  parseNoteContent,
  type DocNode,
} from '../logic';

const s = strings.notes;
const log = createLogger('notes');

/** The note screen: loads the note, then shows the editor (or why it can't). */
export function NoteScreen({ id }: { id: string }) {
  const { note, loading } = useNote(id);
  // Parsed once per note: later saves come from the editor itself.
  const initial = useMemo(() => {
    if (!note) return undefined;
    try {
      return parseNoteContent(note.contentJson);
    } catch (error) {
      log.warn('Could not read a note', { id, error: String(error) });
      return null;
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <View className="flex-1 bg-background" />;
  if (!note || note.deletedAt || initial === undefined) {
    return <Problem title={s.missingTitle} message={s.missingMessage} />;
  }
  if (initial === null) {
    return <Problem title={s.loadErrorTitle} message={s.loadErrorMessage} />;
  }
  return <NoteEditorScreen key={note.id} note={note} initialContent={initial} />;
}

function Problem({ title, message }: { title: string; message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
      <EmptyState
        icon={FileX}
        title={title}
        message={message}
        actionLabel={s.back}
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
      />
    </View>
  );
}

type Sheet = 'actions' | 'move' | 'tags' | 'history' | 'image';

function NoteEditorScreen({ note, initialContent }: { note: Note; initialContent: DocNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const actions = useNoteActions();
  const library = useLibraryActions();
  const addImage = useAddImage();
  const { isKeyboardUp } = useKeyboard();

  const [title, setTitle] = useState(note.title);
  const [wordCount, setWordCount] = useState(note.wordCount);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const content = useNoteAutosave(note.id);
  const saveTitle = useCallback(
    (value: string) => actions.setTitle(note.id, value),
    [actions, note.id],
  );
  const titleSave = useDebouncedSave(saveTitle, AUTOSAVE_DELAY_MS);

  const editor = useNoteEditor({
    initialContent,
    onChange: (doc) => {
      content.onChange(doc);
      if (doc && typeof doc === 'object') setWordCount(countWords(docToText(doc as DocNode)));
    },
  });

  // Leaving the screen: save anything waiting, then drop the note if it was left blank.
  const { flush: flushContent } = content;
  const { flush: flushTitle } = titleSave;
  const onLeave = useRef(() => {});
  useEffect(() => {
    onLeave.current = () => {
      Promise.all([flushContent(), flushTitle()])
        .then(() => actions.discardIfBlank(note.id))
        .catch((error: unknown) => log.warn('Could not tidy up a note', { error: String(error) }));
    };
  }, [actions, flushContent, flushTitle, note.id]);
  useEffect(() => () => onLeave.current(), []);

  const shownTitle = title.trim() || s.untitled;
  const close = () => setSheet(null);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Note change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const insertImage = (source: ImageSourceKind) =>
    run(async () => {
      close();
      const result = await addImage(source);
      if (result.status === 'saved') editor.insertMediaImage(mediaRef(result.media.id));
      else if (result.status === 'permission-denied') toast.show({ message: s.imageDenied });
    });

  const deleteNote = () =>
    run(async () => {
      close();
      await Promise.all([flushContent(), flushTitle()]);
      await actions.delete(note.id);
      if (router.canGoBack()) router.back();
      else router.replace('/library');
      toast.show({
        message: s.deleted(shownTitle),
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restore(note.id)),
      });
    });

  const restoreVersion = (version: NoteVersion) =>
    run(async () => {
      close();
      // Save what's on screen first, so it becomes a version too and nothing is lost.
      await flushContent();
      const doc = await actions.restoreVersion(note.id, version.id);
      editor.setContent(doc);
      setWordCount(countWords(docToText(doc)));
      toast.show({ message: s.history.restored, tone: 'success' });
    });

  const saveLabel =
    content.state === 'saved' && titleSave.state === 'saved'
      ? s.saveStates.saved
      : s.saveStates[content.state === 'error' || titleSave.state === 'error' ? 'error' : 'saving'];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center px-1">
          <IconButton
            icon={ArrowLeft}
            accessibilityLabel={strings.library.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
          />
          <View className="flex-1" />
          {note.pinned ? (
            <IconButton
              icon={Pin}
              accessibilityLabel={s.actions.unpin}
              onPress={() => void run(() => actions.setPinned(note.id, false))}
            />
          ) : null}
          <IconButton
            icon={MoreVertical}
            accessibilityLabel={s.moreOptions}
            onPress={() => setSheet('actions')}
          />
        </View>

        <View className="gap-1 px-4 pb-2">
          <TextInput
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              titleSave.schedule(value);
            }}
            onBlur={() => void flushTitle()}
            placeholder={s.titlePlaceholder}
            placeholderTextColor={colors['fg-muted']}
            accessibilityLabel={s.titleLabel}
            maxLength={120}
            returnKeyType="next"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => editor.focus('end')}
            className="font-heading text-title text-fg"
          />
          <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
            {s.words(wordCount)} · {saveLabel}
          </Text>
        </View>

        <View className="flex-1">
          <NoteEditorView editor={editor} />
        </View>

        <View style={{ paddingBottom: isKeyboardUp ? 0 : insets.bottom }} className="bg-surface">
          <EditorToolbar editor={editor} onInsertImage={() => setSheet('image')} />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={sheet !== null}
        onClose={close}
        title={
          sheet === 'move'
            ? strings.library.moveTitle(shownTitle)
            : sheet === 'tags'
              ? s.tagsTitle
              : sheet === 'history'
                ? s.history.title
                : sheet === 'image'
                  ? s.imageTitle
                  : shownTitle
        }
      >
        {sheet === 'actions' ? (
          <View className="pb-2">
            <SheetAction
              icon={note.pinned ? PinOff : Pin}
              label={note.pinned ? s.actions.unpin : s.actions.pin}
              onPress={() =>
                void run(async () => {
                  close();
                  await actions.setPinned(note.id, !note.pinned);
                  toast.show({ message: note.pinned ? s.unpinned : s.pinned });
                })
              }
            />
            <SheetAction
              icon={FolderInput}
              label={s.actions.move}
              onPress={() => setSheet('move')}
            />
            <SheetAction icon={Tags} label={s.actions.tags} onPress={() => setSheet('tags')} />
            <SheetAction
              icon={History}
              label={s.actions.history}
              onPress={() => setSheet('history')}
            />
            <SheetAction
              icon={Trash2}
              label={s.actions.delete}
              danger
              onPress={() => void deleteNote()}
            />
          </View>
        ) : null}

        {sheet === 'move' ? (
          <MoveSheet
            current={note.folderId ?? null}
            onPick={(folderId) =>
              void run(async () => {
                close();
                await actions.move(note.id, folderId);
                toast.show({ message: s.moved(shownTitle), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet === 'tags' ? (
          <TagsSheet
            noteId={note.id}
            onChange={(tagIds) => void run(() => library.setItemTags('note', note.id, tagIds))}
            onCreate={(name) => library.createTag(name, 'teal')}
            onDone={close}
          />
        ) : null}

        {sheet === 'history' ? (
          <HistorySheet noteId={note.id} onRestore={(v) => void restoreVersion(v)} />
        ) : null}

        {sheet === 'image' ? (
          <View className="pb-2">
            <SheetAction
              icon={Images}
              label={s.imageFromGallery}
              onPress={() => void insertImage('library')}
            />
            <SheetAction
              icon={Camera}
              label={s.imageFromCamera}
              onPress={() => void insertImage('camera')}
            />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function MoveSheet({
  current,
  onPick,
}: {
  current: string | null;
  onPick: (folderId: string | null) => void;
}) {
  const folders = useFolders('note');
  return <FolderPicker folders={folders} currentParentId={current} onPick={onPick} />;
}

function TagsSheet({
  noteId,
  onChange,
  onCreate,
  onDone,
}: {
  noteId: string;
  onChange: (tagIds: string[]) => void;
  onCreate: Parameters<typeof TagPicker>[0]['onCreate'];
  onDone: () => void;
}) {
  const tags = useTags();
  const selected = useItemTagMap('note').get(noteId) ?? [];
  return (
    <View className="gap-3">
      <TagPicker tags={tags} selected={selected} onChange={onChange} onCreate={onCreate} />
      <Button label={s.done} onPress={onDone} />
    </View>
  );
}

function HistorySheet({
  noteId,
  onRestore,
}: {
  noteId: string;
  onRestore: (version: NoteVersion) => void;
}) {
  const versions = useNoteVersions(noteId);
  const timeZone = useProfile().profile?.timezone;
  return (
    <View className="gap-3 pb-2">
      <Text variant="small" tone="muted">
        {versions.length > 0 ? s.history.hint : s.history.empty}
      </Text>
      <ScrollView style={{ maxHeight: 360 }} contentContainerClassName="gap-2">
        {versions.map((version) => {
          const when = formatVersionTime(version.createdAt, timeZone);
          return (
            <View
              key={version.id}
              className="flex-row items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <View className="flex-1">
                <Text variant="bodyStrong">{when}</Text>
                <Text variant="small" tone="muted">
                  {s.history.words(versionWordCount(version))}
                </Text>
              </View>
              <Button
                label={s.history.restore}
                variant="outline"
                accessibilityLabel={s.history.restoreLabel(when)}
                onPress={() => onRestore(version)}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function versionWordCount(version: NoteVersion): number {
  try {
    return countWords(docToText(parseNoteContent(version.contentJson)));
  } catch {
    return 0;
  }
}

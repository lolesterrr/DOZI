import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  FileX,
  FolderInput,
  Library,
  ListPlus,
  MinusCircle,
  MoreVertical,
  Pencil,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Settings2,
  Tags,
  Trash2,
  Trophy,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  EmptyState,
  IconButton,
  Input,
  Text,
  useToast,
} from '@/components/ui';
import type { QuestionType, Quiz } from '@/db/schema';
import { FolderPicker } from '@/features/library/components/FolderPicker';
import { NameForm } from '@/features/library/components/NameForm';
import { SheetAction } from '@/features/library/components/SheetAction';
import { TagPicker } from '@/features/library/components/TagPicker';
import { useFolders, useItemTagMap, useLibraryActions, useTags } from '@/features/library/hooks';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useQuestionBank, useQuiz, useQuizActions, useQuizQuestions } from '../hooks';
import {
  filterQuestions,
  moveInList,
  parsePoints,
  parseQuizSettings,
  POINTS_LIMITS,
  questionTypes,
  totalPoints,
} from '../logic';
import { quizTitleMessage } from '../messages';
import { openQuestionBank, openQuestionEditor } from '../navigation';
import type { QuizQuestionRow } from '../repo';
import { NEW_QUESTION_ID } from './QuestionEditorScreen';
import { previewOf, QuestionFilters, QuestionRow } from './QuestionList';
import { QuizSettingsForm } from './QuizSettingsForm';

const s = strings.quizzes;
const log = createLogger('quizzes');

function backToLibrary() {
  if (router.canGoBack()) router.back();
  else router.replace('/library');
}

/** The quiz builder route: loads the quiz, then shows its questions (or why it can't). */
export function QuizBuilderScreen({ id }: { id: string }) {
  const { quiz, loading } = useQuiz(id);
  const insets = useSafeAreaInsets();
  if (loading) return <View className="flex-1 bg-background" />;
  if (!quiz || quiz.deletedAt) {
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
  return <QuizBuilder quiz={quiz} />;
}

type Sheet =
  | { type: 'actions' }
  | { type: 'rename' }
  | { type: 'settings' }
  | { type: 'move' }
  | { type: 'tags' }
  | { type: 'add' }
  | { type: 'pickType' }
  | { type: 'bank' }
  | { type: 'row'; row: QuizQuestionRow; position: number }
  | { type: 'points'; row: QuizQuestionRow; position: number };

function QuizBuilder({ quiz }: { quiz: Quiz }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const actions = useQuizActions();
  const library = useLibraryActions();
  // Every change to the quiz's questions touches the quiz row, so its `updatedAt` reloads them.
  const { rows } = useQuizQuestions(quiz.id, quiz.updatedAt);
  const folders = useFolders('quiz');
  const tags = useTags();
  const tagMap = useItemTagMap('quiz');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);

  const settings = useMemo(() => parseQuizSettings(quiz.settingsJson), [quiz.settingsJson]);
  const points = totalPoints(rows);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Quiz change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const deleteQuiz = () =>
    run(async () => {
      close();
      const deletedAt = await actions.deleteQuiz(quiz.id);
      backToLibrary();
      toast.show({
        message: s.deleted(quiz.title),
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreQuiz(quiz.id, deletedAt)),
      });
    });

  const move = (index: number, delta: -1 | 1) =>
    run(async () => {
      const order = moveInList(
        rows.map((r) => r.question.id),
        index,
        delta,
      );
      await actions.reorder(quiz.id, order);
    });

  const remove = (row: QuizQuestionRow) =>
    run(async () => {
      close();
      const deletedAt = await actions.removeFromQuiz(quiz.id, row.question.id);
      toast.show({
        message: s.row.removed,
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreToQuiz(quiz.id, row.question.id, deletedAt)),
      });
    });

  const writeNew = (type: QuestionType) => {
    close();
    openQuestionEditor(NEW_QUESTION_ID, { quizId: quiz.id, type });
  };

  const sheetTitle = (() => {
    switch (sheet?.type) {
      case 'rename':
        return s.renameTitle;
      case 'settings':
        return s.settings.title;
      case 'move':
        return strings.library.moveTitle(quiz.title);
      case 'tags':
        return strings.library.itemTagsTitle(quiz.title);
      case 'add':
        return s.addQuestionTitle;
      case 'pickType':
        return s.pickTypeTitle;
      case 'bank':
        return strings.questions.bankTitle;
      case 'row':
        return s.row.number(sheet.position);
      case 'points':
        return s.points.title;
      default:
        return quiz.title;
    }
  })();

  const minutes = settings.timeLimitSec === null ? null : Math.round(settings.timeLimitSec / 60);

  const header = (
    <View className="gap-3 px-4 pb-3 pt-1">
      <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
        {s.summary(rows.length, points)}
      </Text>
      <Text variant="small" tone="muted">
        {s.settingsSummary(settings.mode, minutes)}
      </Text>
      {quiz.description ? <Text variant="body">{quiz.description}</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        <Button label={s.addQuestion} icon={Plus} onPress={() => setSheet({ type: 'add' })} />
        <Button
          label={s.actions.settings}
          icon={Settings2}
          variant="outline"
          onPress={() => setSheet({ type: 'settings' })}
        />
      </View>
      {rows.length > 0 ? (
        <Text variant="small" tone="muted">
          {s.playSoon}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-1">
        <IconButton icon={ArrowLeft} accessibilityLabel={s.back} onPress={backToLibrary} />
        <Text variant="title" numberOfLines={2} className="flex-1">
          {quiz.title}
        </Text>
        <IconButton
          icon={MoreVertical}
          accessibilityLabel={s.moreOptions}
          onPress={() => setSheet({ type: 'actions' })}
        />
      </View>

      <FlashList
        data={rows}
        keyExtractor={(row) => row.question.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            illustration={<Dozi mood="encouraging" />}
            title={s.empty.title}
            message={s.empty.message}
            actionLabel={s.addQuestion}
            onAction={() => setSheet({ type: 'add' })}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item, index }) => (
          <BuilderRow
            row={item}
            position={index + 1}
            isFirst={index === 0}
            isLast={index === rows.length - 1}
            onOpen={() => openQuestionEditor(item.question.id, { quizId: quiz.id })}
            onMoveUp={() => void move(index, -1)}
            onMoveDown={() => void move(index, 1)}
            onMore={() => setSheet({ type: 'row', row: item, position: index + 1 })}
          />
        )}
      />

      <BottomSheet visible={sheet !== null} onClose={close} title={sheetTitle}>
        {sheet?.type === 'actions' ? (
          <View className="pb-2">
            <SheetAction
              icon={quiz.pinned ? PinOff : Pin}
              label={quiz.pinned ? s.actions.unpin : s.actions.pin}
              onPress={() =>
                void run(async () => {
                  close();
                  await actions.setPinned(quiz.id, !quiz.pinned);
                })
              }
            />
            <SheetAction
              icon={Pencil}
              label={s.actions.rename}
              onPress={() => setSheet({ type: 'rename' })}
            />
            <SheetAction
              icon={Settings2}
              label={s.actions.settings}
              onPress={() => setSheet({ type: 'settings' })}
            />
            <SheetAction
              icon={Library}
              label={s.actions.bank}
              onPress={() => {
                close();
                openQuestionBank();
              }}
            />
            <SheetAction
              icon={FolderInput}
              label={s.actions.move}
              onPress={() => setSheet({ type: 'move' })}
            />
            <SheetAction
              icon={Tags}
              label={s.actions.tags}
              onPress={() => setSheet({ type: 'tags' })}
            />
            <SheetAction
              icon={Trash2}
              label={s.actions.delete}
              danger
              onPress={() => void deleteQuiz()}
            />
          </View>
        ) : null}

        {sheet?.type === 'rename' ? (
          <NameForm
            initialName={quiz.title}
            placeholder={s.titlePlaceholder}
            submitLabel={strings.library.save}
            validate={quizTitleMessage}
            onCancel={close}
            onSubmit={(title) =>
              run(async () => {
                await actions.renameQuiz(quiz.id, title);
                close();
              })
            }
          />
        ) : null}

        {sheet?.type === 'settings' ? (
          <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
            <QuizSettingsForm
              settings={settings}
              onCancel={close}
              onSave={(next) =>
                run(async () => {
                  await actions.updateSettings(quiz.id, next);
                  close();
                  toast.show({ message: s.settings.saved, tone: 'success' });
                })
              }
            />
          </ScrollView>
        ) : null}

        {sheet?.type === 'move' ? (
          <FolderPicker
            folders={folders}
            currentParentId={quiz.folderId ?? null}
            onPick={(folderId) =>
              void run(async () => {
                await actions.moveQuiz(quiz.id, folderId);
                close();
                toast.show({ message: strings.library.moved(quiz.title), tone: 'success' });
              })
            }
          />
        ) : null}

        {sheet?.type === 'tags' ? (
          <View className="gap-3">
            <TagPicker
              tags={tags}
              selected={tagMap.get(quiz.id) ?? []}
              onChange={(tagIds) => void run(() => library.setItemTags('quiz', quiz.id, tagIds))}
              onCreate={(name) => library.createTag(name, 'teal')}
            />
            <Button label={strings.library.done} onPress={close} />
          </View>
        ) : null}

        {sheet?.type === 'add' ? (
          <View className="pb-2">
            <SheetAction
              icon={PenLine}
              label={s.writeNew}
              onPress={() => setSheet({ type: 'pickType' })}
            />
            <SheetAction
              icon={ListPlus}
              label={s.fromBank}
              onPress={() => setSheet({ type: 'bank' })}
            />
          </View>
        ) : null}

        {sheet?.type === 'pickType' ? (
          <View className="pb-2">
            {questionTypes.map((type) => (
              <SheetAction
                key={type}
                icon={PenLine}
                label={strings.questions.types[type]}
                onPress={() => writeNew(type)}
              />
            ))}
          </View>
        ) : null}

        {sheet?.type === 'bank' ? (
          <BankPicker
            inQuiz={rows.map((r) => r.question.id)}
            onCancel={close}
            onAdd={(ids) =>
              run(async () => {
                await actions.addQuestionsToQuiz(quiz.id, ids);
                close();
                toast.show({
                  message: strings.questions.addedMany(ids.length),
                  tone: 'success',
                });
              })
            }
          />
        ) : null}

        {sheet?.type === 'row' ? (
          <View className="pb-2">
            <SheetAction
              icon={Pencil}
              label={s.row.edit}
              onPress={() => {
                close();
                openQuestionEditor(sheet.row.question.id, { quizId: quiz.id });
              }}
            />
            <SheetAction
              icon={Trophy}
              label={s.row.setPoints}
              onPress={() => setSheet({ type: 'points', row: sheet.row, position: sheet.position })}
            />
            <SheetAction
              icon={MinusCircle}
              label={s.row.remove}
              danger
              onPress={() => void remove(sheet.row)}
            />
          </View>
        ) : null}

        {sheet?.type === 'points' ? (
          <PointsForm
            initial={sheet.row.points}
            onCancel={close}
            onSave={(value) =>
              run(async () => {
                await actions.setPoints(quiz.id, sheet.row.question.id, value);
                close();
              })
            }
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

/** One question in the builder: number, type, preview, points, up/down and ⋮. */
function BuilderRow({
  row,
  position,
  isFirst,
  isLast,
  onOpen,
  onMoveUp,
  onMoveDown,
  onMore,
}: {
  row: QuizQuestionRow;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMore: () => void;
}) {
  const preview = previewOf(row.question);
  return (
    <View className="mx-4 mb-2 flex-row items-center rounded-lg border border-border bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.row.label(position, preview)}
        accessibilityHint={s.row.edit}
        onPress={onOpen}
        className="min-h-touch flex-1 gap-1 py-3 pl-4 active:opacity-80"
      >
        <Text variant="caption" tone="muted">
          {`${s.row.number(position)} · ${strings.questions.types[row.question.type]} · ${s.row.points(row.points)}`}
        </Text>
        <Text variant="bodyStrong" numberOfLines={2}>
          {preview}
        </Text>
      </Pressable>
      <View className="flex-row items-center">
        <IconButton
          icon={ArrowUp}
          accessibilityLabel={`${s.row.moveUp}: ${s.row.number(position)}`}
          disabled={isFirst}
          onPress={onMoveUp}
          className={isFirst ? 'opacity-40' : undefined}
        />
        <IconButton
          icon={ArrowDown}
          accessibilityLabel={`${s.row.moveDown}: ${s.row.number(position)}`}
          disabled={isLast}
          onPress={onMoveDown}
          className={isLast ? 'opacity-40' : undefined}
        />
        <IconButton
          icon={MoreVertical}
          accessibilityLabel={s.row.more(position)}
          onPress={onMore}
        />
      </View>
    </View>
  );
}

/** Pick bank questions to add (ones already in the quiz are shown but can't be picked). */
function BankPicker({
  inQuiz,
  onAdd,
  onCancel,
}: {
  inQuiz: string[];
  onAdd: (ids: string[]) => void | Promise<void>;
  onCancel: () => void;
}) {
  const bank = useQuestionBank();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<QuestionType | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const shown = useMemo(() => filterQuestions(bank, query, type), [bank, query, type]);

  if (bank.length === 0) {
    return (
      <View className="gap-3 pb-2">
        <Text variant="body" tone="muted">
          {strings.questions.empty.message}
        </Text>
        <Button label={strings.library.cancel} variant="outline" onPress={onCancel} />
      </View>
    );
  }

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <View className="gap-3 pb-2">
      <QuestionFilters query={query} onQueryChange={setQuery} type={type} onTypeChange={setType} />
      <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
        {shown.length === 0 ? (
          <Text variant="body" tone="muted" className="py-4">
            {strings.questions.noMatches}
          </Text>
        ) : (
          shown.map((question) => {
            const already = inQuiz.includes(question.id);
            return (
              <QuestionRow
                key={question.id}
                question={question}
                selectable
                selected={already || picked.includes(question.id)}
                disabled={already}
                note={already ? strings.questions.inQuiz : undefined}
                onPress={() => toggle(question.id)}
              />
            );
          })
        )}
      </ScrollView>
      <Button
        label={strings.questions.addSelected(picked.length)}
        disabled={picked.length === 0}
        onPress={() => void onAdd(picked)}
      />
    </View>
  );
}

function PointsForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: number;
  onSave: (points: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(initial));
  const [tried, setTried] = useState(false);
  const value = parsePoints(text);
  return (
    <View className="gap-4 pb-2">
      <Input
        label={s.points.label}
        hint={s.points.hint(POINTS_LIMITS.min, POINTS_LIMITS.max)}
        error={
          tried && value === null
            ? s.points.problem(POINTS_LIMITS.min, POINTS_LIMITS.max)
            : undefined
        }
        keyboardType="number-pad"
        value={text}
        onChangeText={setText}
      />
      <View className="flex-row flex-wrap gap-3">
        <Button
          label={s.points.save}
          onPress={() => {
            setTried(true);
            if (value !== null) void onSave(value);
          }}
        />
        <Button label={strings.library.cancel} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

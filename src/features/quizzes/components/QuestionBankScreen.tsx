import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  IconButton,
  SelectionBar,
  Text,
  useSelection,
  useToast,
} from '@/components/ui';
import type { QuestionType } from '@/db/schema';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useQuestionBank, useQuestionQuizCounts, useQuizActions } from '../hooks';
import { filterQuestions } from '../logic';
import { openQuestionEditor } from '../navigation';
import { NEW_QUESTION_ID } from './QuestionEditorScreen';
import { QuestionFilters, QuestionRow } from './QuestionList';

const s = strings.questions;
const sel = strings.selection;
const log = createLogger('quizzes');

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/library');
}

/** Every question the student has written, to search, edit or delete (PRODUCT_SPEC §4.3). */
export function QuestionBankScreen() {
  const insets = useSafeAreaInsets();
  const bank = useQuestionBank();
  const counts = useQuestionQuizCounts(bank.length);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<QuestionType | null>(null);
  const shown = useMemo(() => filterQuestions(bank, query, type), [bank, query, type]);
  const toast = useToast();
  const actions = useQuizActions();
  // Long press a question to pick several, then delete them together.
  const shownIds = useMemo(() => shown.map((question) => question.id), [shown]);
  const selection = useSelection(shownIds);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Question bank change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const deleteSelected = () => {
    const ids = selection.ids;
    if (ids.length === 0) return;
    const what = sel.questions(ids.length);
    const usedSomewhere = ids.some((id) => (counts.get(id) ?? 0) > 0);
    Alert.alert(sel.confirmTitle(what), usedSomewhere ? sel.confirmQuestions : sel.confirmMessage, [
      { text: sel.keep, style: 'cancel' },
      {
        text: sel.deleteButton,
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            selection.clear();
            const deletedAt = await actions.deleteQuestions(ids);
            toast.show({
              message: sel.deleted(what),
              actionLabel: strings.library.undo,
              onAction: () => void run(() => actions.restoreQuestions(ids, deletedAt)),
            });
          }),
      },
    ]);
  };

  const header = (
    <View className="gap-3 pb-3 pt-1">
      <Text variant="small" tone="muted">
        {s.bankHint}
      </Text>
      <Button
        label={s.newQuestion}
        icon={Plus}
        className="self-start"
        onPress={() => openQuestionEditor(NEW_QUESTION_ID)}
      />
      {bank.length > 0 ? (
        <QuestionFilters
          query={query}
          onQueryChange={setQuery}
          type={type}
          onTypeChange={setType}
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
        <IconButton icon={ArrowLeft} variant="soft" accessibilityLabel={s.back} onPress={back} />
        <Text variant="heading" numberOfLines={1} className="flex-1">
          {s.bankTitle}
        </Text>
      </View>
      <SelectionBar selection={selection} onDelete={deleteSelected} />
      <FlashList
        data={shown}
        extraData={selection.ids}
        keyExtractor={(question) => question.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          bank.length === 0 ? (
            <EmptyState
              illustration={<Dozi mood="encouraging" />}
              title={s.empty.title}
              message={s.empty.message}
            />
          ) : (
            <Text variant="body" tone="muted" className="py-6 text-center">
              {s.noMatches}
            </Text>
          )
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => {
          const used = counts.get(item.id) ?? 0;
          return (
            <QuestionRow
              question={item}
              note={used > 0 ? s.usedIn(used) : undefined}
              selectable={selection.selecting}
              selected={selection.isSelected(item.id)}
              onPress={() =>
                selection.selecting ? selection.toggle(item.id) : openQuestionEditor(item.id)
              }
              onLongPress={() => selection.begin(item.id)}
            />
          );
        }}
      />
    </View>
  );
}

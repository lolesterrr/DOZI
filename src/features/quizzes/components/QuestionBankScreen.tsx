import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, Text } from '@/components/ui';
import type { QuestionType } from '@/db/schema';
import { Dozi } from '@/features/mascot';
import { strings } from '@/i18n/strings';

import { useQuestionBank, useQuestionQuizCounts } from '../hooks';
import { filterQuestions } from '../logic';
import { openQuestionEditor } from '../navigation';
import { NEW_QUESTION_ID } from './QuestionEditorScreen';
import { QuestionFilters, QuestionRow } from './QuestionList';

const s = strings.questions;

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
      <View className="flex-row items-center gap-1 px-1">
        <IconButton icon={ArrowLeft} accessibilityLabel={s.back} onPress={back} />
        <Text variant="title" numberOfLines={1} className="flex-1">
          {s.bankTitle}
        </Text>
      </View>
      <FlashList
        data={shown}
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
              onPress={() => openQuestionEditor(item.id)}
            />
          );
        }}
      />
    </View>
  );
}

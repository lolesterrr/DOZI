import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { NotebookPen, Pin, Search, SearchX, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { EmptyState, IconButton, Text } from '@/components/ui';
import { useNoteSearch } from '@/features/notes/hooks';
import { splitHighlights } from '@/features/notes/logic';
import type { NoteSearchResult } from '@/features/notes/repo';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

const s = strings.search;

/**
 * Global search (opened from every tab's header). Searches notes for now (task 1.4); cards, drugs
 * and topics join in later tasks. Matching words are bold and underlined on a gold background.
 */
export function SearchScreen() {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const { query, results, error } = useNoteSearch(input);

  const body =
    results === null ? (
      <EmptyState icon={Search} title={s.hintTitle} message={s.hintMessage} />
    ) : results.length === 0 ? (
      <EmptyState
        icon={SearchX}
        title={error ? s.failed : s.noResultsTitle(query)}
        message={error ? undefined : s.noResultsMessage}
      />
    ) : null;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Search color={colors['fg-muted']} size={20} />
        <TextInput
          value={input}
          onChangeText={setInput}
          autoFocus
          placeholder={s.inputPlaceholder}
          placeholderTextColor={colors['fg-muted']}
          selectionColor={colors.primary}
          accessibilityLabel={s.inputLabel}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          className="min-h-touch flex-1 font-body text-body text-fg"
        />
        {input !== '' ? (
          <IconButton icon={X} accessibilityLabel={s.clear} onPress={() => setInput('')} />
        ) : null}
      </View>

      {body ?? (
        <FlashList
          data={results ?? []}
          keyExtractor={(result) => result.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text
              variant="small"
              tone="muted"
              className="px-4 pb-1 pt-3"
              accessibilityLiveRegion="polite"
            >
              {s.resultCount(results?.length ?? 0)}
            </Text>
          }
          renderItem={({ item }) => <ResultRow result={item} />}
        />
      )}
    </View>
  );
}

function ResultRow({ result }: { result: NoteSearchResult }) {
  const { colors } = useTheme();
  const title = splitHighlights(result.title);
  const titleText = title
    .map((part) => part.text)
    .join('')
    .trim();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/note/[id]', params: { id: result.id } })}
      className="min-h-touch flex-row gap-3 border-b border-border px-4 py-3 active:bg-surface-muted"
    >
      <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-md bg-primary-soft">
        <NotebookPen color={colors['on-primary-soft']} size={20} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          <Highlighted
            parts={titleText === '' ? [{ text: strings.notes.untitled, match: false }] : title}
            variant="bodyStrong"
            numberOfLines={1}
          />
          {result.pinned ? <Pin color={colors['fg-muted']} size={14} /> : null}
        </View>
        {result.snippet !== '' ? (
          <Highlighted
            parts={splitHighlights(result.snippet)}
            variant="small"
            tone="muted"
            numberOfLines={3}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Text with the matching words marked: bold, underlined, on a gold background (not colour alone). */
function Highlighted({
  parts,
  variant,
  tone,
  numberOfLines,
}: {
  parts: { text: string; match: boolean }[];
  variant: 'bodyStrong' | 'small';
  tone?: 'muted';
  numberOfLines: number;
}) {
  return (
    <Text variant={variant} tone={tone} numberOfLines={numberOfLines} className="flex-shrink">
      {parts.map((part, index) =>
        part.match ? (
          <Text
            key={index}
            variant={variant}
            className="bg-accent-soft font-body-semibold text-on-accent-soft underline"
          >
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

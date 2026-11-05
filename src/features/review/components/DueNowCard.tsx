import { Brain, ChevronRight, Layers } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Blob, BottomSheet, Button, Card, Text } from '@/components/ui';
import { useDecks } from '@/features/decks/hooks';
import { SheetAction } from '@/features/library/components/SheetAction';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useDueByDeck } from '../hooks';
import { decksWithDue } from '../logic';
import { openReview } from '../navigation';

const s = strings.practice;

/**
 * Practice → "Due now": how many cards are waiting across every deck, a button to review them
 * all, each deck with cards due (tap to review just that deck), and "Cram a deck".
 */
export function DueNowCard() {
  const decks = useDecks();
  const { colors } = useTheme();
  const [cramming, setCramming] = useState(false);
  // Adding or editing cards touches the deck, so this changes and the count is redone.
  const { total, byDeck } = useDueByDeck(decks.map((d) => d.updatedAt).join('|'));
  const due = useMemo(() => decksWithDue(decks, byDeck), [decks, byDeck]);

  return (
    <Card layer="primary" className="gap-3">
      <View className="flex-row items-center gap-3">
        <Blob icon={Layers} tint="teal" size={52} />
        <Text variant="heading" className="flex-1">
          {s.dueTitle}
        </Text>
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {decks.length === 0 ? s.noDecks : total === null ? s.loading : s.dueCount(total)}
      </Text>
      {decks.length > 0 && total ? (
        <Button label={s.studyAll} onPress={() => openReview('all')} />
      ) : null}
      {due.length > 1 ? (
        <View className="gap-1">
          {due.map((deck) => (
            <Pressable
              key={deck.deckId}
              accessibilityRole="button"
              accessibilityLabel={s.openDeck(deck.title, deck.due)}
              onPress={() => openReview(deck.deckId)}
              className="min-h-touch flex-row items-center gap-3 rounded-md px-2 py-2 active:bg-surface-muted"
            >
              <Text className="flex-1" numberOfLines={2}>
                {deck.title}
              </Text>
              <Text variant="small" tone="muted">
                {s.deckDue(deck.due)}
              </Text>
              <ChevronRight color={colors['fg-muted']} size={20} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {decks.length > 0 ? (
        <Button label={s.cram} icon={Brain} variant="outline" onPress={() => setCramming(true)} />
      ) : null}

      <BottomSheet visible={cramming} onClose={() => setCramming(false)} title={s.cramTitle}>
        <Text tone="muted" className="pb-2">
          {s.cramHint}
        </Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {decks.map((deck) => (
            <SheetAction
              key={deck.id}
              icon={Layers}
              label={deck.title}
              onPress={() => {
                setCramming(false);
                openReview(deck.id, 'cram');
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </Card>
  );
}

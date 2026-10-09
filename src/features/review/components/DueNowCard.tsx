import { Layers } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useDecks } from '@/features/decks/hooks';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useDueCount } from '../hooks';
import { openReview } from '../navigation';

const s = strings.practice;

/** Practice → "Due now": how many cards are waiting across every deck, and a button to start. */
export function DueNowCard() {
  const { colors } = useTheme();
  const decks = useDecks();
  // Adding or editing cards touches the deck, so this changes and the count is redone.
  const due = useDueCount('all', decks.map((d) => d.updatedAt).join('|'));
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
          <Layers color={colors['on-primary-soft']} size={22} />
        </View>
        <Text variant="heading" className="flex-1">
          {s.dueTitle}
        </Text>
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {decks.length === 0 ? s.noDecks : due === null ? s.loading : s.dueCount(due)}
      </Text>
      {decks.length > 0 && due ? (
        <Button label={s.studyAll} onPress={() => openReview('all')} />
      ) : null}
    </Card>
  );
}

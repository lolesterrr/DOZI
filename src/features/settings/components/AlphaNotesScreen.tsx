import { ScrollView, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

const s = strings.alpha;

/** What is not finished in the alpha (task 2.10), so testers aren't surprised. */
export function AlphaNotesScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-10">
      <Text tone="muted">{s.intro}</Text>
      {s.items.map((item) => (
        <Card key={item.title} className="gap-1">
          <View accessible>
            <Text variant="bodyStrong">{item.title}</Text>
            <Text variant="small" tone="muted">
              {item.text}
            </Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

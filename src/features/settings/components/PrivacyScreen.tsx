import { ScrollView, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

const s = strings.privacy;

/** The privacy policy (task 3.6), in the app so it can be read offline. */
export function PrivacyScreen() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-10">
      <Card layer="accent">
        <Text variant="bodyStrong">{s.draftNotice}</Text>
      </Card>
      {s.sections.map((section) => (
        <Card key={section.title} className="gap-1">
          <View accessible>
            <Text variant="bodyStrong">{section.title}</Text>
            <Text tone="muted">{section.text}</Text>
          </View>
        </Card>
      ))}
      <Text variant="small" tone="muted">
        {s.updated}
      </Text>
      <Text variant="small" tone="muted">
        {strings.disclaimer}
      </Text>
    </ScrollView>
  );
}

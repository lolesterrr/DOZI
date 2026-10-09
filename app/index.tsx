import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

// Placeholder home screen for task 0.1. The real tabs arrive in task 0.5.
export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 p-6">
        <View className="flex-1 items-center justify-center gap-2">
          <Text variant="display">{strings.home.greeting}</Text>
          <Text tone="muted" className="text-center">
            {strings.home.tagline}
          </Text>
          {__DEV__ ? (
            <Button
              label={strings.home.openGallery}
              variant="outline"
              onPress={() => router.push('/dev/ui')}
              className="mt-6"
            />
          ) : null}
        </View>
        <Text variant="caption" tone="muted" className="text-center">
          {strings.disclaimer}
        </Text>
      </View>
    </SafeAreaView>
  );
}

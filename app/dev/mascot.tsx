import { Redirect, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, IconButton, Text } from '@/components/ui';
import {
  Dozi,
  DoziSpeech,
  doziMoods,
  mascotContexts,
  messageMood,
  pickMessage,
} from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { useTheme, type ThemePreference } from '@/theme';

const s = strings.mascotGallery;

// Developer-only gallery of the mascot, Monsieur Pierre (task 2.1): every mood, a few sizes and the speech bubbles.
// Release builds redirect home.
export default function MascotGalleryScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: strings.devGallery.themeSystem },
  { value: 'light', label: strings.devGallery.themeLight },
  { value: 'dark', label: strings.devGallery.themeDark },
];

function Gallery() {
  const { preference, setPreference } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center gap-2 border-b border-border px-2 py-1">
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={strings.common.close}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="heading">{s.title}</Text>
      </View>
      <ScrollView contentContainerClassName="gap-8 p-5 pb-24">
        <View className="gap-3">
          <Text variant="subheading" tone="primary">
            {s.background}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {themeOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={preference === option.value}
                onPress={() => setPreference(option.value)}
              />
            ))}
          </View>
        </View>

        <View className="gap-3">
          <Text variant="subheading" tone="primary">
            {s.moods}
          </Text>
          <View className="flex-row flex-wrap gap-4">
            {doziMoods.map((mood) => (
              <View key={mood} className="w-[30%] items-center gap-1">
                <Dozi mood={mood} size={96} />
                <Text variant="small">{strings.mascot.moods[mood]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <Text variant="subheading" tone="primary">
            {s.sizes}
          </Text>
          <View className="flex-row items-end gap-4">
            <Dozi mood="happy" size={40} />
            <Dozi mood="happy" size={64} />
            <Dozi mood="happy" size={120} />
            <Dozi mood="happy" size={160} animated={false} />
          </View>
          <Text variant="caption" tone="muted">
            {s.still}
          </Text>
        </View>

        <View className="gap-3">
          <Text variant="subheading" tone="primary">
            {s.speech}
          </Text>
          {mascotContexts.map((context, i) => (
            <DoziSpeech
              key={context}
              mood={messageMood(context)}
              message={pickMessage(context, i)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

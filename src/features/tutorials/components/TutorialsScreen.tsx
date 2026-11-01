import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import { DoziSpeech } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { TUTORIALS, type Tutorial } from '../catalog';
import { formatClock, groupTutorials, splitDuration } from '../logic';

/** Me → Tutorials: the feature videos, then the "coming soon" trailers. */
export function TutorialsScreen() {
  const s = strings.tutorials;
  const { tutorials, trailers } = groupTutorials(TUTORIALS);
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 px-4 py-4">
      <DoziSpeech mood="happy" message={s.intro} />
      <View className="gap-3">
        <Text variant="heading" accessibilityRole="header">
          {s.howTitle}
        </Text>
        {tutorials.map((t) => (
          <TutorialRow key={t.id} tutorial={t} />
        ))}
      </View>
      <View className="gap-3">
        <View className="gap-1">
          <Text variant="heading" accessibilityRole="header">
            {s.soonTitle}
          </Text>
          <Text variant="small" tone="muted">
            {s.soonHint}
          </Text>
        </View>
        {trailers.map((t) => (
          <TutorialRow key={t.id} tutorial={t} />
        ))}
      </View>
      <Text variant="small" tone="muted">
        {s.silentNote}
      </Text>
    </ScrollView>
  );
}

function TutorialRow({ tutorial }: { tutorial: Tutorial }) {
  const { colors } = useTheme();
  const s = strings.tutorials;
  const item = s.items[tutorial.key];
  const { minutes, seconds } = splitDuration(tutorial.seconds);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.rowLabel(item.title, s.durationLabel(minutes, seconds))}
      accessibilityHint={s.rowHint}
      onPress={() => router.push({ pathname: '/tutorials/[id]', params: { id: tutorial.id } })}
      className="min-h-touch flex-row items-center gap-4 rounded-lg border border-border bg-surface p-3 active:opacity-80"
    >
      <View className="overflow-hidden rounded-md bg-surface-muted">
        <Image
          source={tutorial.poster}
          style={{ width: 54, height: 96 }}
          contentFit="cover"
          accessible={false}
        />
      </View>
      <View className="flex-1 gap-1">
        {tutorial.kind === 'trailer' ? (
          <View className="self-start rounded-full bg-accent-soft px-2.5 py-0.5">
            <Text variant="caption" tone="inherit" className="text-on-accent-soft">
              {s.soonBadge}
            </Text>
          </View>
        ) : null}
        <Text variant="bodyStrong">{item.title}</Text>
        <Text variant="small" tone="muted">
          {item.summary}
        </Text>
        <Text variant="caption" tone="muted">
          {s.duration(formatClock(tutorial.seconds))}
        </Text>
      </View>
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
        <Play color={colors['on-primary-soft']} size={20} />
      </View>
    </Pressable>
  );
}

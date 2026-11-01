import { router, Stack } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ScrollView, View } from 'react-native';

import { Button, EmptyState, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { findTutorial, TUTORIALS, type Tutorial } from '../catalog';
import { nextTutorial } from '../logic';

/** One tutorial video, playing straight away, with a button to the next one. */
export function TutorialPlayerScreen({ id }: { id: string | undefined }) {
  const tutorial = findTutorial(id);
  if (!tutorial) {
    return (
      <View className="flex-1 bg-background px-4">
        <Stack.Screen options={{ title: strings.tutorials.title }} />
        <EmptyState
          title={strings.tutorials.missingTitle}
          message={strings.tutorials.missingMessage}
        />
      </View>
    );
  }
  // A new player for each video, so moving to the next one starts it fresh.
  return <Player key={tutorial.id} tutorial={tutorial} />;
}

function Player({ tutorial }: { tutorial: Tutorial }) {
  const s = strings.tutorials;
  const item = s.items[tutorial.key];
  const next = nextTutorial(TUTORIALS, tutorial.id);
  const player = useVideoPlayer(tutorial.video, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 py-4">
      <Stack.Screen options={{ title: item.title }} />
      <View className="items-center">
        <View
          className="w-full max-w-[420px] overflow-hidden rounded-lg border border-border bg-surface-muted"
          style={{ aspectRatio: 9 / 16 }}
        >
          <VideoView
            player={player}
            style={{ flex: 1 }}
            contentFit="contain"
            nativeControls
            accessibilityLabel={item.title}
          />
        </View>
      </View>
      <View className="gap-1">
        <Text variant="heading" accessibilityRole="header">
          {item.title}
        </Text>
        <Text tone="muted">{item.summary}</Text>
      </View>
      {next ? (
        <Button
          label={s.next(s.items[next.key].title)}
          onPress={() => router.replace({ pathname: '/tutorials/[id]', params: { id: next.id } })}
        />
      ) : null}
      <Button label={s.backToList} variant="outline" onPress={() => router.back()} />
    </ScrollView>
  );
}

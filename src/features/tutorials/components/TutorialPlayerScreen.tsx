import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, ProgressBar, Text } from '@/components/ui';
import { formatBytes } from '@/features/media/logic';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { findTutorial, TUTORIALS, type Tutorial } from '../catalog';
import { useTutorialVideo } from '../hooks';
import { nextTutorial } from '../logic';
import type { VideoStatus } from '../store';

/**
 * One tutorial video. The welcome video is built in; the others download the first time
 * (task 3.7) and then play straight away, also offline.
 */
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
  // A new screen body for each video, so moving to the next one starts it fresh.
  return <PlayerScreen key={tutorial.id} tutorial={tutorial} />;
}

const frameClass =
  'w-full max-w-[420px] overflow-hidden rounded-[20px] border-2 border-outline bg-surface-muted';

function PlayerScreen({ tutorial }: { tutorial: Tutorial }) {
  const s = strings.tutorials;
  const item = s.items[tutorial.key];
  const next = nextTutorial(TUTORIALS, tutorial.id);
  const { status, plan, retrying, offlineTries, download, retry } = useTutorialVideo(tutorial);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 py-4">
      <Stack.Screen options={{ title: item.title }} />
      <View className="items-center">
        <View className={frameClass} style={{ aspectRatio: 9 / 16 }}>
          {status.kind === 'ready' ? (
            <Player source={status.source} title={item.title} />
          ) : (
            <Image
              source={tutorial.poster}
              style={{ flex: 1, opacity: 0.6 }}
              contentFit="cover"
              accessible={false}
            />
          )}
        </View>
      </View>
      {status.kind === 'ready' ? null : (
        <DownloadCard
          status={status}
          plan={plan}
          retrying={retrying}
          offlineTries={offlineTries}
          onDownload={download}
          onRetry={retry}
        />
      )}
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

function Player({ source, title }: { source: number | string; title: string }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls
      accessibilityLabel={title}
    />
  );
}

/** What's happening with a video that isn't on the phone yet, and the button to get it. */
function DownloadCard({
  status,
  plan,
  retrying,
  offlineTries,
  onDownload,
  onRetry,
}: {
  status: Exclude<VideoStatus, { kind: 'ready' }>;
  plan: 'download' | 'ask' | 'offline' | null;
  retrying: boolean;
  offlineTries: number;
  onDownload: () => void;
  onRetry: () => void;
}) {
  const s = strings.tutorials;
  const { colors } = useTheme();
  if (status.kind === 'unavailable') {
    return (
      <Card className="gap-2 p-4">
        <Text>{s.unavailableMessage}</Text>
      </Card>
    );
  }
  const size = formatBytes(status.bytes);
  const percent = Math.round(status.progress * 100);

  if (status.state === 'downloading') {
    return (
      <Card className="gap-3 p-4" accessibilityLiveRegion="polite">
        <Text variant="bodyStrong">{s.downloading(percent, size)}</Text>
        <ProgressBar value={status.progress} accessibilityLabel={s.downloadingRow(percent)} />
        <Text variant="small" tone="muted">
          {s.downloadingHint}
        </Text>
      </Card>
    );
  }
  if (retrying) {
    return (
      <Card className="flex-row items-center gap-3 p-4" accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <Text variant="bodyStrong" className="flex-1">
          {s.retrying}
        </Text>
      </Card>
    );
  }
  if (status.state === 'failed') {
    return (
      <Card className="gap-3 p-4" accessibilityLiveRegion="polite">
        <Text>{status.failures > 1 ? s.failedAgain(status.failures) : s.failedMessage}</Text>
        {status.error ? (
          <Text variant="small" tone="muted" selectable>
            {s.errorDetails(status.error)}
          </Text>
        ) : null}
        <Button label={s.tryAgain} onPress={onRetry} />
      </Card>
    );
  }
  if (plan === 'ask') {
    return (
      <Card className="gap-3 p-4">
        <Text>{s.askMessage}</Text>
        <Button label={s.downloadAnyway(size)} onPress={onDownload} />
        <Text variant="small" tone="muted">
          {s.firstPlayNote}
        </Text>
      </Card>
    );
  }
  if (plan === 'offline') {
    return (
      <Card className="gap-3 p-4" accessibilityLiveRegion="polite">
        <Text>
          {offlineTries > 0 ? s.stillOffline(size, offlineTries) : s.offlineMessage(size)}
        </Text>
        <Button label={s.tryAgain} variant="outline" onPress={onRetry} />
      </Card>
    );
  }
  // Checking the connection (a moment), then the download starts by itself.
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <ActivityIndicator color={colors.primary} />
      <Text className="flex-1">{s.firstPlayNote}</Text>
    </Card>
  );
}

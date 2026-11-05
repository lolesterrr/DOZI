import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Blob, Button, Text } from '@/components/ui';
import { formatBytes } from '@/features/media/logic';
import { DoziSpeech } from '@/features/mascot';
import { strings } from '@/i18n/strings';

import { TUTORIALS, type Tutorial } from '../catalog';
import { useRefreshTutorials, useTutorialDownloads, useVideoStatus } from '../hooks';
import { formatClock, groupTutorials, splitDuration } from '../logic';

/** Me → Tutorials: the feature videos, then the "coming soon" trailers. */
export function TutorialsScreen() {
  const s = strings.tutorials;
  const { tutorials, trailers } = groupTutorials(TUTORIALS);
  useRefreshTutorials(TUTORIALS);
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 px-4 py-4">
      <DoziSpeech mood="happy" message={s.intro} />
      <View className="gap-3">
        <Text variant="heading" accessibilityRole="header">
          {s.howTitle}
        </Text>
        {tutorials.map((t, i) => (
          <TutorialRow key={t.id} tutorial={t} index={i} />
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
        {trailers.map((t, i) => (
          <TutorialRow key={t.id} tutorial={t} index={i} />
        ))}
      </View>
      <Text variant="small" tone="muted">
        {s.soundNote}
      </Text>
      <Downloads />
    </ScrollView>
  );
}

/** The space downloaded videos take, with a button to free it. Hidden when there are none. */
function Downloads() {
  const s = strings.tutorials;
  const { bytes, remove } = useTutorialDownloads(TUTORIALS);
  const [removed, setRemoved] = useState(false);
  if (bytes === 0) {
    return removed ? (
      <Text variant="small" tone="muted" accessibilityLiveRegion="polite">
        {s.removed}
      </Text>
    ) : null;
  }
  return (
    <View className="gap-2">
      <Text variant="heading" accessibilityRole="header">
        {s.storageTitle}
      </Text>
      <Text variant="small" tone="muted">
        {s.storageUsed(formatBytes(bytes))}
      </Text>
      <Button
        label={s.removeDownloads}
        variant="outline"
        onPress={() => {
          remove();
          setRemoved(true);
        }}
      />
    </View>
  );
}

/** Whether a cloud video is on the phone, how far its download is, or how big it is. */
function downloadNote(
  tutorial: Tutorial,
  status: ReturnType<typeof useVideoStatus>,
): string | null {
  const s = strings.tutorials;
  if (status.kind === 'cloud') {
    return status.state === 'downloading'
      ? s.downloadingRow(Math.round(status.progress * 100))
      : formatBytes(status.bytes);
  }
  if (status.kind === 'ready' && tutorial.video.kind === 'cloud') return s.downloaded;
  return null;
}

function TutorialRow({ tutorial, index }: { tutorial: Tutorial; index: number }) {
  const s = strings.tutorials;
  const item = s.items[tutorial.key];
  const { minutes, seconds } = splitDuration(tutorial.seconds);
  const status = useVideoStatus(tutorial);
  const note = downloadNote(tutorial, status);
  const length = s.durationLabel(minutes, seconds);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.rowLabel(item.title, note ? `${length}, ${note}` : length)}
      accessibilityHint={s.rowHint}
      onPress={() => router.push({ pathname: '/tutorials/[id]', params: { id: tutorial.id } })}
      className="min-h-touch flex-row items-center gap-4 rounded-[20px] border-2 border-outline bg-surface p-3 active:opacity-80"
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
          {note
            ? `${s.duration(formatClock(tutorial.seconds))} · ${note}`
            : s.duration(formatClock(tutorial.seconds))}
        </Text>
      </View>
      <Blob icon={Play} tint="violet" index={index} size={46} />
    </Pressable>
  );
}

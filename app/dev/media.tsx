import { Redirect, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconButton, Text, useToast } from '@/components/ui';
import { useDatabase } from '@/db/DatabaseProvider';
import { ImageAnnotator } from '@/features/annotation';
import {
  formatBytes,
  MediaImage,
  MediaViewer,
  useAddImage,
  useCleanUpNow,
  useMediaList,
  useStorageUsed,
  type ImageSourceKind,
} from '@/features/media';
import { deleteMedia, restoreMedia } from '@/features/media/repo';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

const s = strings.devMedia;
const log = createLogger('media');

// Developer-only check of the media pipeline (task 1.1). Release builds redirect home.
export default function DevMediaScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <MediaCheck />;
}

function MediaCheck() {
  const db = useDatabase();
  const toast = useToast();
  const items = useMediaList();
  const storageUsed = useStorageUsed();
  const addImage = useAddImage();
  const cleanUpNow = useCleanUpNow();
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState<string | null>(null);

  async function add(source: ImageSourceKind) {
    setBusy(true);
    try {
      const result = await addImage(source);
      if (result.status === 'saved') {
        const before = result.beforeBytes === null ? '?' : formatBytes(result.beforeBytes);
        setLastResult(s.saved(before, formatBytes(result.afterBytes)));
      } else {
        setLastResult(result.status === 'cancelled' ? s.cancelled : s.cameraDenied);
      }
    } catch (error) {
      log.error('Adding an image failed', error);
      toast.show({ message: s.failed, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await deleteMedia(db, id);
    toast.show({ message: s.deleted, actionLabel: s.undo, onAction: () => restoreMedia(db, id) });
  }

  async function cleanUp() {
    const removed = await cleanUpNow();
    toast.show({ message: s.cleanedUp(removed) });
  }

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
      <ScrollView contentContainerClassName="gap-4 p-5">
        <Card className="gap-3">
          <Button
            label={busy ? s.working : s.pickFromGallery}
            disabled={busy}
            onPress={() => add('library')}
          />
          <Button
            label={s.takePhoto}
            variant="outline"
            disabled={busy}
            onPress={() => add('camera')}
          />
          {lastResult ? <Text selectable>{lastResult}</Text> : null}
        </Card>
        <Card className="gap-1">
          <Text variant="caption" tone="muted">
            {s.storageUsed}
          </Text>
          <Text variant="subheading">
            {formatBytes(storageUsed)} · {s.imageCount(items.length)}
          </Text>
        </Card>
        {items.length === 0 ? (
          <Text tone="muted">{s.empty}</Text>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {items.map((item) => (
              <View key={item.id} className="w-[47%] gap-1">
                <MediaImage
                  id={item.id}
                  className="aspect-square w-full"
                  onPress={() => setViewing(item.id)}
                />
                <Text variant="caption" tone="muted">
                  {item.width}×{item.height} · {formatBytes(item.bytes)}
                  {item.derivedFrom ? ` · ${s.annotatedBadge}` : ''}
                </Text>
                <Button
                  label={s.annotate}
                  variant="outline"
                  onPress={() => setAnnotating(item.id)}
                />
                <Button label={s.delete} variant="ghost" onPress={() => remove(item.id)} />
              </View>
            ))}
          </View>
        )}
        <Text tone="muted">{s.persistHint}</Text>
        <Button label={s.cleanUp} variant="outline" onPress={cleanUp} />
      </ScrollView>
      <MediaViewer id={viewing} onClose={() => setViewing(null)} />
      <ImageAnnotator
        mediaId={annotating}
        onClose={() => setAnnotating(null)}
        onSaved={() => {
          setAnnotating(null);
          toast.show({ message: s.annotated, tone: 'success' });
        }}
      />
    </SafeAreaView>
  );
}

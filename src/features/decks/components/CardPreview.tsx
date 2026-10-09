import { View } from 'react-native';

import { Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { draftInstances, type CardDraft } from '../logic';
import { CardFaceView } from './CardFaceView';

const s = strings.cards;

function instanceName(subKey: string): string | null {
  if (subKey === 'reverse') return s.previewReverse;
  if (/^c\d+$/.test(subKey)) return subKey;
  return null;
}

/**
 * Every card the draft will make, each with its question side and answer side, so the student
 * sees exactly what reviewing will look like (a cloze with c1 and c2 shows two cards).
 */
export function CardPreview({
  draft,
  onImagePress,
}: {
  draft: CardDraft;
  onImagePress?: (mediaId: string) => void;
}) {
  const instances = draftInstances(draft);
  if (instances.length === 0) {
    return (
      <Text variant="body" tone="muted" className="py-4">
        {s.previewEmpty}
      </Text>
    );
  }
  return (
    <View className="gap-4 pb-2">
      {instances.map(({ subKey, faces }, index) => {
        const name = instanceName(subKey);
        return (
          <View key={subKey} className="gap-3 rounded-lg border border-border bg-surface p-4">
            <Text variant="label" tone="muted">
              {s.previewCard(index + 1, instances.length)}
              {name ? ` · ${name}` : ''}
            </Text>
            <View className="gap-1.5">
              <Text variant="label">{s.previewFront}</Text>
              <CardFaceView face={faces.front} onImagePress={onImagePress} />
            </View>
            <View className="h-px bg-border" />
            <View className="gap-1.5">
              <Text variant="label">{s.previewBack}</Text>
              <CardFaceView face={faces.back} onImagePress={onImagePress} />
            </View>
            {faces.extra.length > 0 ? (
              <View className="gap-1.5 rounded-md bg-surface-muted p-3">
                <Text variant="label">{s.previewExtra}</Text>
                <CardFaceView face={faces.extra} onImagePress={onImagePress} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

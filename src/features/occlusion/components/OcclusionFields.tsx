import { Camera, Images, PenLine, RefreshCw, SquareDashed } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, Chip, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { numberedPicture, occlusionModes, type OcclusionDraft, type OcclusionMode } from '../logic';
import { OcclusionImage } from './OcclusionImage';

const s = strings.occlusion;

export type OcclusionFieldsProps = {
  occlusion: OcclusionDraft;
  onPickImage: (source: 'library' | 'camera') => void;
  /** Shows "Change image": the screen asks gallery or camera. */
  onChangeImage: () => void;
  onEditBoxes: () => void;
  onDrawOnImage: () => void;
  onModeChange: (mode: OcclusionMode) => void;
};

/** The card editor's part for an image occlusion card: the diagram, its boxes and the mode. */
export function OcclusionFields({
  occlusion,
  onPickImage,
  onChangeImage,
  onEditBoxes,
  onDrawOnImage,
  onModeChange,
}: OcclusionFieldsProps) {
  const picture = numberedPicture(occlusion);
  const count = occlusion.masks.length;
  return (
    <View className="gap-5">
      <View className="gap-2">
        <Text variant="label">{s.diagram}</Text>
        {picture ? (
          <>
            <OcclusionImage picture={picture} />
            <Button label={s.editBoxes(count)} icon={SquareDashed} onPress={onEditBoxes} />
            <View className="flex-row flex-wrap gap-2">
              <Button
                label={s.drawOnImage}
                icon={PenLine}
                variant="outline"
                className="flex-1"
                onPress={onDrawOnImage}
              />
              <Button
                label={s.changeImage}
                icon={RefreshCw}
                variant="outline"
                className="flex-1"
                onPress={onChangeImage}
              />
            </View>
            <Text variant="label" accessibilityLiveRegion="polite">
              {s.cardCount(count)}
            </Text>
          </>
        ) : (
          <>
            <Text variant="small" tone="muted">
              {s.diagramHint}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                label={s.chooseImage}
                icon={Images}
                variant="secondary"
                className="flex-1"
                onPress={() => onPickImage('library')}
              />
              <Button
                label={s.takePhoto}
                icon={Camera}
                variant="outline"
                className="flex-1"
                onPress={() => onPickImage('camera')}
              />
            </View>
          </>
        )}
      </View>

      <View className="gap-2">
        <Text variant="label">{s.modeLabel}</Text>
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {occlusionModes.map((mode) => (
            <Chip
              key={mode}
              label={s.modes[mode]}
              selected={occlusion.mode === mode}
              accessibilityRole="radio"
              onPress={() => onModeChange(mode)}
            />
          ))}
        </View>
        <Text variant="small" tone="muted">
          {s.modeHints[occlusion.mode]}
        </Text>
      </View>
    </View>
  );
}

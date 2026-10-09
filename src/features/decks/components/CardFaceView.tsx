import { View } from 'react-native';

import { Text } from '@/components/ui';
import { MediaImage } from '@/features/media/components/MediaImage';
import { OcclusionImage } from '@/features/occlusion/components/OcclusionImage';
import { strings } from '@/i18n/strings';

import type { Face, FaceSpan } from '../logic';

const spanClasses: Record<FaceSpan['style'], string> = {
  plain: '',
  // A hidden cloze: bold on a teal tint, and the […] / [hint] text itself marks it.
  hidden: 'font-body-semibold bg-primary-soft text-on-primary-soft',
  // A revealed cloze: bold and underlined on gold, so it never depends on colour alone.
  answer: 'font-body-semibold underline bg-accent-soft text-on-accent-soft',
};

export type CardFaceViewProps = {
  face: Face;
  /** Called with a media id when an image is tapped (e.g. to view it full screen). */
  onImagePress?: (mediaId: string) => void;
};

/**
 * Draws one side of a card: lines of text (clozes styled), images and occlusion diagrams. Native views only (no
 * WebView), so the preview and the review screen (task 1.8) stay light on low-end phones.
 */
export function CardFaceView({ face, onImagePress }: CardFaceViewProps) {
  return (
    <View className="gap-2">
      {face.map((block, index) =>
        block.kind === 'occlusion' ? (
          <OcclusionImage key={index} picture={block.picture} />
        ) : block.kind === 'text' ? (
          <Text key={index} variant="body">
            {block.spans.map((span, i) => (
              <Text key={i} variant="body" tone="inherit" className={spanClasses[span.style]}>
                {span.text}
              </Text>
            ))}
          </Text>
        ) : (
          <MediaImage
            key={index}
            id={block.mediaId}
            contentFit="contain"
            className="aspect-[4/3] w-full rounded-md bg-surface-muted"
            accessibilityLabel={strings.media.imageLabel}
            onPress={onImagePress ? () => onImagePress(block.mediaId) : undefined}
          />
        ),
      )}
    </View>
  );
}

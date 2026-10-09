import { View } from 'react-native';

import { cn, Text } from '@/components/ui';
import { MediaImage } from '@/features/media/components/MediaImage';
import { strings } from '@/i18n/strings';

import type { MaskLook, OcclusionPicture } from '../logic';

const s = strings.occlusion;

const boxClasses: Record<MaskLook, string> = {
  // Covered and marked with "?", so the asked box never depends on colour alone.
  asked: 'items-center justify-center rounded-sm border-2 border-on-primary bg-primary',
  covered: 'rounded-sm border border-fg-muted bg-surface-muted',
  // Uncovered: only a thick outline is left, so the label underneath shows through.
  revealed: 'rounded-sm border-4 border-accent',
  numbered: 'items-center justify-center rounded-sm border-2 border-primary bg-primary-soft',
};

function pictureLabel(picture: OcclusionPicture): string {
  if (picture.asked === 0) return s.pictureNumbered(picture.total);
  return picture.revealed
    ? s.pictureRevealed(picture.asked, picture.total)
    : s.pictureAsked(picture.asked, picture.total);
}

/** Positions in percent of the picture, so boxes land on the same spot at any width. */
export function boxStyle(box: { x: number; y: number; w: number; h: number }) {
  return {
    position: 'absolute' as const,
    left: `${box.x * 100}%` as const,
    top: `${box.y * 100}%` as const,
    width: `${box.w * 100}%` as const,
    height: `${box.h * 100}%` as const,
  };
}

/**
 * A diagram with its occlusion boxes drawn over it, as plain native views (no Skia), so reviews
 * stay light. The picture keeps the image's own shape, so the boxes line up with the labels.
 * Not tappable: the full-screen viewer would show the image without its boxes.
 */
export function OcclusionImage({ picture }: { picture: OcclusionPicture }) {
  const ratio = picture.width > 0 && picture.height > 0 ? picture.width / picture.height : 4 / 3;
  return (
    <View
      className="w-full overflow-hidden rounded-md bg-surface-muted"
      style={{ aspectRatio: ratio }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={pictureLabel(picture)}
      testID="occlusion-picture"
    >
      <MediaImage id={picture.mediaId} contentFit="fill" className="h-full w-full" />
      {picture.boxes.map((box, index) => (
        <View
          key={index}
          style={boxStyle(box)}
          className={cn(boxClasses[box.look])}
          testID={`occlusion-box-${box.look}`}
        >
          {box.look === 'asked' ? (
            <Text variant="bodyStrong" tone="onPrimary" numberOfLines={1}>
              {s.askedMark}
            </Text>
          ) : null}
          {box.look === 'numbered' ? (
            <Text
              variant="caption"
              tone="inherit"
              className="font-body-semibold text-on-primary-soft"
              numberOfLines={1}
            >
              {box.number}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

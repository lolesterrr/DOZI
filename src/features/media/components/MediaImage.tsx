import { Image, type ImageContentFit } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, Skeleton, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useMediaUri } from '../hooks';

export type MediaImageProps = {
  /** The media id (the part after `media://`). */
  id: string;
  /** What the image shows, for screen readers. */
  accessibilityLabel?: string;
  contentFit?: ImageContentFit;
  /** Size and layout. Give it a width and a height (or an aspect ratio). */
  className?: string;
  onPress?: () => void;
};

/**
 * Shows a stored image by its media id. Uses the file on this phone; if the file isn't here
 * (deleted, or not downloaded yet) it shows a calm placeholder instead of breaking.
 */
export function MediaImage({
  id,
  accessibilityLabel = strings.media.imageLabel,
  contentFit = 'cover',
  className,
  onPress,
}: MediaImageProps) {
  const { colors } = useTheme();
  const { uri, loading } = useMediaUri(id);

  let content;
  if (loading) {
    content = <Skeleton height="100%" radius={0} />;
  } else if (!uri) {
    content = (
      <View
        className="h-full w-full items-center justify-center gap-1 bg-surface-muted p-2"
        accessible
        accessibilityLabel={strings.media.missing}
      >
        <ImageOff color={colors['fg-muted']} size={24} />
        <Text variant="caption" tone="muted" className="text-center">
          {strings.media.missing}
        </Text>
      </View>
    );
  } else {
    content = (
      <Image
        source={{ uri }}
        contentFit={contentFit}
        style={{ width: '100%', height: '100%' }}
        accessible
        accessibilityLabel={accessibilityLabel}
        transition={150}
      />
    );
  }

  const classes = cn('overflow-hidden rounded-lg', className);
  if (!onPress) return <View className={classes}>{content}</View>;
  return (
    <Pressable
      className={cn(classes, 'active:opacity-80')}
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={strings.media.openHint}
    >
      {content}
    </Pressable>
  );
}

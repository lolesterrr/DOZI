import { Image, type ImageContentFit } from 'expo-image';
import { CloudDownload, ImageOff, RefreshCw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { cn, Skeleton, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useMediaSource } from '../hooks';
import { formatBytes } from '../logic';

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
 * Shows a stored image by its media id. Uses the file on this phone; a picture backed up from
 * another phone downloads by itself (or waits for a tap with Data saver on mobile data, task
 * 3.5); if the file can't be had it shows a calm placeholder instead of breaking.
 */
export function MediaImage({
  id,
  accessibilityLabel = strings.media.imageLabel,
  contentFit = 'cover',
  className,
  onPress,
}: MediaImageProps) {
  const { colors } = useTheme();
  const source = useMediaSource(id);

  let content;
  if (source.kind === 'loading') {
    content = <Skeleton height="100%" radius={0} />;
  } else if (source.kind === 'cloud') {
    if (source.state === 'downloading') {
      content = (
        <View accessible accessibilityLabel={strings.media.downloading} className="h-full w-full">
          <Skeleton height="100%" radius={0} />
        </View>
      );
    } else {
      const failed = source.state === 'failed';
      const label = failed
        ? strings.media.downloadFailed
        : strings.media.tapToDownload(formatBytes(source.bytes));
      const Icon = failed ? RefreshCw : CloudDownload;
      // Its own button, so a tap downloads instead of opening the viewer.
      return (
        <Pressable
          className={cn(
            'items-center justify-center gap-1 overflow-hidden rounded-lg bg-surface-muted p-2 active:opacity-80',
            className,
          )}
          onPress={source.download}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={strings.media.downloadHint}
        >
          <Icon color={colors['fg-muted']} size={24} />
          <Text variant="caption" tone="muted" className="text-center">
            {label}
          </Text>
        </Pressable>
      );
    }
  } else if (source.kind === 'missing') {
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
        source={{ uri: source.uri }}
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

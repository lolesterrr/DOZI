import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { Modal, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useMediaUri } from '../hooks';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

export type MediaViewerProps = {
  /** The media id to show, or null when the viewer is closed. */
  id: string | null;
  onClose: () => void;
  accessibilityLabel?: string;
};

/** Full-screen image viewer: pinch to zoom, drag to move, double-tap to zoom in or reset. */
export function MediaViewer({ id, onClose, accessibilityLabel }: MediaViewerProps) {
  return (
    <Modal
      visible={id !== null}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
      transparent
    >
      {/* A Modal is a separate native window, so gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {id ? (
          <ViewerContent id={id} onClose={onClose} accessibilityLabel={accessibilityLabel} />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function ViewerContent({
  id,
  onClose,
  accessibilityLabel = strings.media.imageLabel,
}: {
  id: string;
  onClose: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const { uri } = useMediaUri(id);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, MIN_SCALE * 0.8, MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE);
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
      savedScale.value = Math.max(scale.value, MIN_SCALE);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= MIN_SCALE) return;
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.value <= MIN_SCALE;
      const next = zoomIn ? DOUBLE_TAP_SCALE : MIN_SCALE;
      scale.value = withTiming(next);
      savedScale.value = next;
      x.value = withTiming(0);
      y.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.scrim }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, imageStyle]}>
          {uri ? (
            <Image
              source={{ uri }}
              contentFit="contain"
              style={{ flex: 1 }}
              accessible
              accessibilityLabel={accessibilityLabel}
            />
          ) : (
            <View className="flex-1 items-center justify-center p-6">
              <Pill>{strings.media.missing}</Pill>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
      <SafeAreaView
        edges={['top']}
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, right: 0 }}
      >
        <IconButton
          icon={X}
          variant="soft"
          accessibilityLabel={strings.common.close}
          onPress={onClose}
          className="m-3"
        />
      </SafeAreaView>
      <View pointerEvents="none" className="absolute bottom-8 w-full items-center px-6">
        <Pill>{strings.media.zoomHint}</Pill>
      </View>
    </View>
  );
}

// Readable on top of any photo: the toast colours, which are AA-checked in both themes.
function Pill({ children }: { children: string }) {
  return (
    <View className="rounded-full bg-inverse px-3 py-1">
      <Text variant="caption" tone="inherit" className="text-center text-on-inverse">
        {children}
      </Text>
    </View>
  );
}

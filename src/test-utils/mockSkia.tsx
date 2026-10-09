import type { ReactNode } from 'react';
import { View } from 'react-native';

// Stands in for @shopify/react-native-skia in Jest (see jest.setup.js), which needs native code.
// Each drawing element becomes a View carrying its props, so tests can see what would be drawn.
// What the drawing really looks like is checked on the device.

function element(name: string) {
  return function SkiaElement({ children, ...props }: { children?: ReactNode }) {
    return (
      <View testID={`skia-${name}`} {...{ skiaProps: props }}>
        {children}
      </View>
    );
  };
}

export const Canvas = element('Canvas');
export const Group = element('Group');
export const Image = element('Image');
export const Path = element('Path');
export const Rect = element('Rect');
export const Oval = element('Oval');
export const Text = element('Text');

const fakeImage = { width: () => 1600, height: () => 1200 };
export const useImage = (uri: string | null) => (uri ? fakeImage : null);

export const matchFont = () => ({ getTextWidth: (text: string) => text.length * 10 });

export const ImageFormat = { JPEG: 3, PNG: 4 };
export const drawAsImage = async () => ({ encodeToBytes: () => new Uint8Array([1, 2, 3]) });
export const Skia = {
  Data: { fromURI: async () => ({}) },
  Image: { MakeImageFromEncoded: () => fakeImage },
};

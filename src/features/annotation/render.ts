import { drawAsImage, ImageFormat, matchFont, Skia, type SkFont } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { createElement } from 'react';
import { Platform } from 'react-native';

import { deviceMediaStore } from '@/features/media/files';
import { MEDIA_JPEG_QUALITY } from '@/features/media/logic';
import { newId } from '@/lib/ids';

import { AnnotationScene } from './components/AnnotationScene';
import { textSizeFor, type Size } from './logic';
import type { RenderAnnotation } from './pipeline';

// The device-only half: draws the image and its annotation with Skia and saves a JPEG.

/** The bold system font, at the label size for an image of this size. */
export function labelFont(size: Size): SkFont {
  return matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: textSizeFor(size),
    fontWeight: 'bold',
  });
}

/** Flattens the drawing onto the image at full size and writes it to the cache folder. */
export const renderAnnotationOnDevice: RenderAnnotation = async (base, annotation) => {
  const uri = base.localUri ? deviceMediaStore.resolve(base.localUri) : null;
  if (!uri) throw new Error('The original image is not on this phone');
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!image) throw new Error('The original image could not be read');

  const size = { width: annotation.width, height: annotation.height };
  const flat = await drawAsImage(
    createElement(AnnotationScene, {
      image,
      size,
      shapes: annotation.shapes,
      font: labelFont(size),
    }),
    size,
  );
  if (!flat) throw new Error('The drawing could not be rendered');

  const bytes = flat.encodeToBytes(ImageFormat.JPEG, Math.round(MEDIA_JPEG_QUALITY * 100));
  const file = new File(Paths.cache, `annotated-${newId()}.jpg`);
  file.write(bytes);
  return { uri: file.uri, width: size.width, height: size.height };
};

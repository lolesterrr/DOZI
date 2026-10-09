import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { MEDIA_JPEG_QUALITY, resizeTarget } from './logic';
import type { CompressedImage, ImageSourceKind, PickedImage } from './pipeline';

// The device-only half of the pipeline: the system picker/camera and the image compressor.

/** Opens the gallery or camera. Returns null if the student cancels or denies the camera. */
export async function pickFromDevice(
  source: ImageSourceKind,
): Promise<PickedImage | 'permission-denied' | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    // Full quality here; we compress once ourselves, so the image isn't compressed twice.
    quality: 1,
    exif: false,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'permission-denied';
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    // Android's system photo picker needs no permission.
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height, bytes: asset.fileSize };
}

/** Shrinks to a long edge of ≤ 1600 px and re-encodes as JPEG 0.7, into the cache folder. */
export async function compressOnDevice(image: PickedImage): Promise<CompressedImage> {
  const context = ImageManipulator.manipulate(image.uri);
  try {
    const target = resizeTarget(image);
    if (target) context.resize(target);
    const rendered = await context.renderAsync();
    try {
      const saved = await rendered.saveAsync({
        compress: MEDIA_JPEG_QUALITY,
        format: SaveFormat.JPEG,
      });
      return { uri: saved.uri, width: saved.width, height: saved.height };
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}

import type { Media } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { MediaFileStore } from '@/features/media/files';
import { formatBytes, MEDIA_MIME } from '@/features/media/logic';
import { getMedia, insertMedia } from '@/features/media/repo';
import { ensureProfile } from '@/features/profile/repo';
import { newId as defaultNewId } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { nowIso, systemClock, type Clock } from '@/lib/time';

import { emptyAnnotation, parseAnnotation, serializeAnnotation, type Annotation } from './logic';

// ARCHITECTURE §5 step 6: an annotated image is a *new* media row with `derived_from` = the
// original and the strokes in `annotation_json`, plus a flattened JPEG for showing and export.
// The original row and file are never changed. The renderer is passed in so Jest can test this.

const log = createLogger('annotation');

/** What the drawing screen opens with: the image to draw on and any earlier drawing. */
export type AnnotationStart = { base: Media; annotation: Annotation };

/**
 * Re-opening an annotated copy starts from its original image with the old strokes, so they can
 * still be undone or changed. Anything else starts with a blank drawing over the image itself.
 * Returns null when the image isn't on this phone.
 */
export async function loadAnnotationStart(
  db: AppDatabase,
  mediaId: string,
): Promise<AnnotationStart | null> {
  const row = await getMedia(db, mediaId);
  if (!row) return null;
  const previous = parseAnnotation(row.annotationJson);
  if (row.derivedFrom && previous) {
    const original = await getMedia(db, row.derivedFrom);
    if (original?.localUri) return { base: original, annotation: previous };
  }
  if (!row.localUri) return null;
  return { base: row, annotation: emptyAnnotation(row.width, row.height) };
}

/** Draws the image and annotation into a JPEG in the cache folder. */
export type RenderAnnotation = (
  base: Media,
  annotation: Annotation,
) => Promise<{ uri: string; width: number; height: number }>;

export type SaveAnnotationDeps = {
  render: RenderAnnotation;
  files: MediaFileStore;
  newId?: () => string;
  clock?: Clock;
};

/** Saves the drawing as a new image derived from `base`. Returns the new media row. */
export async function saveAnnotatedImage(
  db: AppDatabase,
  base: Media,
  annotation: Annotation,
  { render, files, newId = defaultNewId, clock = systemClock }: SaveAnnotationDeps,
): Promise<Media> {
  const json = serializeAnnotation(annotation);
  const rendered = await render(base, annotation);
  const id = newId();
  const { relativePath, bytes } = files.adopt(rendered.uri, id);
  const profile = await ensureProfile(db);
  const saved = await insertMedia(
    db,
    {
      id,
      ownerId: profile.id,
      localUri: relativePath,
      mime: MEDIA_MIME,
      width: rendered.width,
      height: rendered.height,
      bytes,
      uploadStatus: 'local',
      derivedFrom: base.id,
      annotationJson: json,
    },
    { now: () => nowIso(clock) },
  );
  log.info('Saved annotated image', {
    id,
    derivedFrom: base.id,
    shapes: annotation.shapes.length,
    size: formatBytes(bytes),
  });
  return saved;
}

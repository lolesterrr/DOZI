import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import type { Media } from '@/db/schema';
import { deviceMediaStore } from '@/features/media/files';
import { createLogger } from '@/lib/logger';

import type { Annotation } from './logic';
import { loadAnnotationStart, saveAnnotatedImage, type AnnotationStart } from './pipeline';
import { renderAnnotationOnDevice } from './render';

const log = createLogger('annotation');

export type AnnotationStartState =
  { status: 'loading' } | { status: 'missing' } | { status: 'ready'; start: AnnotationStart };

/** The image (and any earlier drawing) to open the drawing screen with. */
export function useAnnotationStart(mediaId: string): AnnotationStartState {
  const db = useDatabase();
  const [state, setState] = useState<AnnotationStartState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadAnnotationStart(db, mediaId)
      .then((start) => {
        if (live) setState(start ? { status: 'ready', start } : { status: 'missing' });
      })
      .catch((error: unknown) => {
        log.warn('Could not open an image for drawing', { mediaId, error: String(error) });
        if (live) setState({ status: 'missing' });
      });
    return () => {
      live = false;
    };
  }, [db, mediaId]);
  return state;
}

/** Returns a function that saves a drawing as a new image derived from `base`. */
export function useSaveAnnotation() {
  const db = useDatabase();
  return useCallback(
    (base: Media, annotation: Annotation) =>
      saveAnnotatedImage(db, base, annotation, {
        render: renderAnnotationOnDevice,
        files: deviceMediaStore,
      }),
    [db],
  );
}

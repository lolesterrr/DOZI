import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { currentConnection } from '@/features/media/network';
import { useAppSettings } from '@/features/settings/hooks';

import type { Tutorial } from './catalog';
import { deviceTutorialDeps } from './device';
import { downloadPlan, type DownloadPlan } from './logic';
import {
  downloadedBytes,
  downloadTutorial,
  getTutorialsRevision,
  refreshManifest,
  removeDownloads,
  subscribeTutorials,
  videoStatus,
  type VideoStatus,
} from './store';

const deps = deviceTutorialDeps;

function useRevision() {
  return useSyncExternalStore(subscribeTutorials, getTutorialsRevision);
}

/** Fetches the bucket's manifest when the Tutorials list opens (once per app run). */
export function useRefreshTutorials(tutorials: readonly Tutorial[]) {
  useEffect(() => {
    void refreshManifest(tutorials, deps);
  }, [tutorials]);
}

/** Where a video is (built in, downloaded, downloading…), kept up to date. */
export function useVideoStatus(tutorial: Tutorial): VideoStatus {
  useRevision();
  return videoStatus(tutorial, deps);
}

/**
 * The player's video (task 3.7). A video that isn't on the phone downloads by itself when the
 * connection allows (Data saver); otherwise `plan` says why it's waiting and `download` starts
 * it anyway.
 */
export function useTutorialVideo(tutorial: Tutorial): {
  status: VideoStatus;
  /** null while checking the connection, or once a download has started. */
  plan: DownloadPlan | null;
  download: () => void;
} {
  const status = useVideoStatus(tutorial);
  const { loading, settings } = useAppSettings();
  const [plan, setPlan] = useState<DownloadPlan | null>(null);
  const needsDownload = status.kind === 'cloud' && status.state === 'idle';

  const download = useCallback(() => {
    setPlan(null);
    void downloadTutorial(tutorial, deps);
  }, [tutorial]);

  useEffect(() => {
    if (!needsDownload || loading) return;
    let cancelled = false;
    void currentConnection().then((connection) => {
      if (cancelled) return;
      const next = downloadPlan(settings.wifiOnly, connection);
      if (next === 'download') void downloadTutorial(tutorial, deps);
      else setPlan(next);
    });
    return () => {
      cancelled = true;
    };
  }, [needsDownload, loading, settings.wifiOnly, tutorial]);

  return { status, plan: needsDownload ? plan : null, download };
}

/** The space the downloaded videos take, and a way to remove them. */
export function useTutorialDownloads(tutorials: readonly Tutorial[]): {
  bytes: number;
  remove: () => void;
} {
  useRevision();
  const remove = useCallback(() => removeDownloads(deps), []);
  return { bytes: downloadedBytes(tutorials, deps), remove };
}

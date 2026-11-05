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

/** "Trying again…" shows at least this long, even when the try fails at once. */
export const MIN_RETRY_MS = 1200;

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
 * connection allows (Data saver); otherwise `plan` says why it's waiting. `download` starts it
 * anyway (the student asked); `retry` checks the connection again and tries, showing
 * `retrying` for at least a moment so the student sees something happened.
 */
export function useTutorialVideo(tutorial: Tutorial): {
  status: VideoStatus;
  /** null while checking the connection, or once a download has started. */
  plan: DownloadPlan | null;
  /** True while a "Try again" is in progress. */
  retrying: boolean;
  /** How many times "Try again" found the phone still offline. */
  offlineTries: number;
  download: () => void;
  retry: () => void;
} {
  const status = useVideoStatus(tutorial);
  const { loading, settings } = useAppSettings();
  const [plan, setPlan] = useState<DownloadPlan | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [offlineTries, setOfflineTries] = useState(0);
  const needsDownload = status.kind === 'cloud' && status.state === 'idle';

  const download = useCallback(() => {
    setPlan(null);
    void downloadTutorial(tutorial, deps);
  }, [tutorial]);

  const retry = useCallback(() => {
    setRetrying(true);
    void (async () => {
      const started = Date.now();
      if ((await currentConnection()) === 'none') {
        setPlan('offline');
        setOfflineTries((n) => n + 1);
      } else {
        setPlan(null);
        await downloadTutorial(tutorial, deps);
      }
      const rest = MIN_RETRY_MS - (Date.now() - started);
      if (rest > 0) await deps.pause(rest);
      setRetrying(false);
    })();
  }, [tutorial]);

  useEffect(() => {
    if (!needsDownload || loading || retrying) return;
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
  }, [needsDownload, loading, retrying, settings.wifiOnly, tutorial]);

  return {
    status,
    plan: needsDownload ? plan : null,
    retrying,
    offlineTries,
    download,
    retry,
  };
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

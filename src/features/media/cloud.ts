import type { SupabaseClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import type { AppDatabase } from '@/db/types';
import { getAppSettings } from '@/features/settings/repo';

import { deviceMediaStore, mediaDirectory } from './files';
import {
  MEDIA_BUCKET,
  mediaFileName,
  mediaNetworkAllowed,
  mediaRelativePath,
  SIGNED_URL_SECONDS,
} from './logic';
import { currentConnection } from './network';
import type { MediaCloud, MediaTransferDeps } from './transfer';

// The real `MediaCloud`: Supabase Storage as the signed-in student (the bucket's policies only
// allow their own folder), with files read from and saved to the phone's media folder.

export function supabaseMediaCloud(client: SupabaseClient): MediaCloud {
  const bucket = () => client.storage.from(MEDIA_BUCKET);
  return {
    async upload(remotePath, fileUri, mime) {
      const body = await new File(fileUri).arrayBuffer();
      const { error } = await bucket().upload(remotePath, body, {
        contentType: mime,
        upsert: true,
      });
      if (error) throw new Error(error.message);
    },
    async download(remotePath, id) {
      const { data, error } = await bucket().createSignedUrl(remotePath, SIGNED_URL_SECONDS);
      if (error || !data) throw new Error(error?.message ?? 'No download link');
      const target = new File(mediaDirectory(), mediaFileName(id));
      await File.downloadFileAsync(data.signedUrl, target, { idempotent: true });
      return mediaRelativePath(id);
    },
  };
}

/** Everything uploads and downloads need on a real phone, for the signed-in student. */
export function deviceMediaTransfer(db: AppDatabase, client: SupabaseClient): MediaTransferDeps {
  return {
    cloud: supabaseMediaCloud(client),
    resolve: (relativePath) => deviceMediaStore.resolve(relativePath),
    networkAllowed: async () =>
      mediaNetworkAllowed((await getAppSettings(db)).wifiOnly, await currentConnection()),
  };
}

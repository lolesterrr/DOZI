import { parseSupabaseConfig } from '@/features/account/logic';

import { deviceTutorialFiles } from './files';
import type { TutorialDeps } from './store';

// The real phone: the videos folder and the Supabase project from `.env`. The bucket is public,
// so downloads need no sign-in.

const TIMEOUT_MS = 15_000;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export const deviceTutorialDeps: TutorialDeps = {
  files: deviceTutorialFiles,
  projectUrl:
    parseSupabaseConfig(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    )?.url ?? null,
  fetchText,
};

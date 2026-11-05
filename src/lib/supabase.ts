import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  joinChunks,
  parseChunkCount,
  parseSupabaseConfig,
  splitIntoChunks,
} from '@/features/account/logic';

// The one Supabase client (ARCHITECTURE §1). Only the project URL and the public anon/publishable
// key are in the app; what each signed-in student may read is decided by the RLS rules on the
// server (supabase/migrations). Null when `.env` has no Supabase values: the app then works
// offline-only, exactly as before (sign-in is optional).

// Supabase uses crypto.getRandomValues for the Google sign-in (PKCE) secret. Hermes has no Web
// Crypto, so borrow expo-crypto's secure random numbers.
const globalCrypto = globalThis as { crypto?: { getRandomValues?: unknown } };
if (typeof globalCrypto.crypto?.getRandomValues !== 'function') {
  globalCrypto.crypto = {
    ...(globalCrypto.crypto ?? {}),
    getRandomValues: Crypto.getRandomValues,
  };
}

/**
 * Keeps the sign-in session in the phone's encrypted store (Android Keystore / iOS Keychain),
 * split into pieces because each value should stay under ~2 KB.
 */
const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = parseChunkCount(await SecureStore.getItemAsync(`${key}.count`));
    if (n === 0) return null;
    const chunks = await Promise.all(
      Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    return joinChunks(chunks);
  },
  async setItem(key: string, value: string): Promise<void> {
    const previous = parseChunkCount(await SecureStore.getItemAsync(`${key}.count`));
    const chunks = splitIntoChunks(value);
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
    for (let i = chunks.length; i < previous; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  },
  async removeItem(key: string): Promise<void> {
    const n = parseChunkCount(await SecureStore.getItemAsync(`${key}.count`));
    await SecureStore.deleteItemAsync(`${key}.count`);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
};

const config = parseSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

/** The Supabase client, or null when the app isn't connected to a Supabase project. */
export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.anonKey, {
      auth: {
        // On the web build (used only for tutorial screenshots) the browser's storage is fine.
        storage: Platform.OS === 'web' ? undefined : secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

/** True when sign-in can be offered. */
export const isSupabaseConfigured = supabase !== null;

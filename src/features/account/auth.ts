import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/db/DatabaseProvider';
import type { AppDatabase } from '@/db/types';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

import {
  classifyAuthError,
  cleanCode,
  normaliseEmail,
  parseAuthCallback,
  type AuthProblem,
} from './logic';
import { adoptLocalData, forgetAccount, type AdoptionResult } from './repo';

// Sign-in with Supabase Auth (task 3.2): an emailed one-time code, or Google in the browser.
// Sign-in is optional; every screen works without it.

const log = createLogger('account');

// ---------------------------------------------------------------------------------------------
// The current session, shared by every screen
// ---------------------------------------------------------------------------------------------
type SessionSnapshot = { session: Session | null; loading: boolean };

let snapshot: SessionSnapshot = { session: null, loading: supabase !== null };
const listeners = new Set<() => void>();
let started = false;

function setSnapshot(next: SessionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function startSessionWatch() {
  if (started || !supabase) return;
  started = true;
  supabase.auth
    .getSession()
    .then(({ data }) => setSnapshot({ session: data.session, loading: false }))
    .catch((error: unknown) => {
      log.warn('could not read the saved session', { error: String(error) });
      setSnapshot({ session: null, loading: false });
    });
  supabase.auth.onAuthStateChange((_event, session) => setSnapshot({ session, loading: false }));
}

function subscribe(listener: () => void) {
  startSessionWatch();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Who is signed in (null when nobody is, or when Supabase isn't set up). */
export function useAuthSession(): SessionSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/**
 * Mounted once in the root layout. Refreshes the sign-in token only while the app is open (the
 * Supabase advice for phones), and finishes adopting the phone's study if the app was closed in
 * the middle of a sign-in.
 */
export function useAuthLifecycle() {
  const db = useDatabase();
  const { session } = useAuthSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!userId) return;
    finishSignIn(db, userId).catch((error: unknown) =>
      log.warn('adoption failed', { error: String(error) }),
    );
  }, [db, userId]);
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------
export type AuthResult =
  | { ok: true }
  | { ok: false; problem: AuthProblem | 'cancelled' | 'other-account' | 'not-configured' };

function failure(error: { message?: string; status?: number } | null): AuthResult {
  if (error) log.warn('auth error', { message: error.message, status: error.status });
  return { ok: false, problem: classifyAuthError(error) };
}

/**
 * Makes the phone's study belong to the account that just signed in. If this phone's study
 * belongs to another account, signs out again instead of mixing two students' work.
 */
export async function finishSignIn(db: AppDatabase, userId: string): Promise<AdoptionResult> {
  const result = await adoptLocalData(db, userId);
  if (result.decision === 'other-account') {
    log.warn('signed in with a different account than the one this phone belongs to');
    await supabase?.auth.signOut({ scope: 'local' });
  } else if (result.decision === 'adopt') {
    log.info('adopted the phone’s study', { rows: result.rowsAdopted });
  }
  return result;
}

async function afterSignIn(db: AppDatabase, userId: string | undefined): Promise<AuthResult> {
  if (!userId) return { ok: false, problem: 'unknown' };
  const { decision } = await finishSignIn(db, userId);
  return decision === 'other-account' ? { ok: false, problem: 'other-account' } : { ok: true };
}

/** Emails a one-time code. New emails get an account automatically. */
export async function sendEmailCode(rawEmail: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, problem: 'not-configured' };
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normaliseEmail(rawEmail),
      options: { shouldCreateUser: true },
    });
    return error ? failure(error) : { ok: true };
  } catch (error) {
    return failure(error as Error);
  }
}

/** Checks the code from the email and signs in. */
export async function verifyEmailCode(
  db: AppDatabase,
  rawEmail: string,
  rawCode: string,
): Promise<AuthResult> {
  if (!supabase) return { ok: false, problem: 'not-configured' };
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normaliseEmail(rawEmail),
      token: cleanCode(rawCode),
      type: 'email',
    });
    if (error) return failure(error);
    return afterSignIn(db, data.user?.id);
  } catch (error) {
    return failure(error as Error);
  }
}

/**
 * Google sign-in in the phone's browser. Google sends the student back to
 * `dozi://auth/callback` (or the Expo Go address), which must be in Supabase's Redirect URLs.
 */
export async function signInWithGoogle(db: AppDatabase): Promise<AuthResult> {
  if (!supabase) return { ok: false, problem: 'not-configured' };
  try {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return failure(error);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { ok: false, problem: 'cancelled' };

    const callback = parseAuthCallback(result.url);
    if (callback.kind === 'error') return failure({ message: callback.message });
    if (callback.kind !== 'code') return { ok: false, problem: 'unknown' };

    const flowId = (data as { flowId?: string | null }).flowId;
    const exchanged = await supabase.auth.exchangeCodeForSession(
      callback.code,
      flowId ? { flowId } : undefined,
    );
    if (exchanged.error) return failure(exchanged.error);
    return afterSignIn(db, exchanged.data.user?.id);
  } catch (error) {
    return failure(error as Error);
  }
}

export type DeleteAccountResult = { ok: true } | { ok: false; problem: 'offline' | 'unknown' };

/**
 * Deletes the account and its backup (task 3.6) through the `delete-account` Edge Function,
 * which removes the pictures in Storage and the auth user (every row cascades). Then this phone
 * forgets the account and signs out; the study stays here.
 */
export async function deleteAccount(db: AppDatabase): Promise<DeleteAccountResult> {
  if (!supabase) return { ok: false, problem: 'unknown' };
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: 'DELETE' },
    });
    if (error || !(data as { deleted?: boolean } | null)?.deleted) {
      log.warn('delete-account failed', { error: String(error?.message ?? data) });
      const offline = /network|fetch|failed to send/i.test(String(error?.message ?? ''));
      return { ok: false, problem: offline ? 'offline' : 'unknown' };
    }
  } catch (error) {
    log.warn('delete-account failed', { error: String(error) });
    return { ok: false, problem: 'offline' };
  }
  await forgetAccount(db);
  await signOut();
  return { ok: true };
}

/** Signs out on this phone. The study stays on the phone. */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut({ scope: 'local' });
}

// Optional sign-in (task 3.2, PRODUCT_SPEC §3, ARCHITECTURE §3.2). Pure rules only: no network,
// no database. The Supabase calls live in `auth.ts`, the database work in `repo.ts`.

/** The two public values the app needs to reach Supabase. */
export type SupabaseConfig = { url: string; anonKey: string };

/**
 * The Supabase project from `.env` / the EAS environment, or null when it isn't set up. Without
 * it the app works exactly as before and the Account screen is hidden.
 */
export function parseSupabaseConfig(
  rawUrl: string | undefined | null,
  rawKey: string | undefined | null,
): SupabaseConfig | null {
  const url = rawUrl?.trim();
  const anonKey = rawKey?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) return null;
    return { url: `${parsed.protocol}//${parsed.host}`, anonKey };
  } catch {
    return null;
  }
}

/** Trimmed and lower-cased, so "Joe@Mail.com " and "joe@mail.com" are the same account. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** A plausible email address (the server does the real check by sending the code). */
export function isValidEmail(raw: string): boolean {
  const email = normaliseEmail(raw);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** The one-time code from the email, digits only (spaces and dashes typed by the student go). */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Supabase sends 6 digits by default; projects can choose up to 10. */
export function isValidCode(raw: string): boolean {
  const code = cleanCode(raw);
  return code.length >= 6 && code.length <= 10;
}

/** What to do with the study already on this phone when someone signs in. */
export type AdoptionDecision =
  /** The phone's study becomes this account's (first sign-in on this phone). */
  | 'adopt'
  /** Already this account's (signing in again after signing out). */
  | 'already-adopted'
  /** The study on this phone belongs to a different account: don't mix them. */
  | 'other-account';

/**
 * ARCHITECTURE §3.2 "adopting local data". The profile's id is the owner of every local row, so
 * adopting means giving that id (and every row's owner_id) the auth user id.
 */
export function adoptionDecision(
  profile: { id: string; authUserId: string | null },
  authUserId: string,
): AdoptionDecision {
  if (profile.id === authUserId) return 'already-adopted';
  if (profile.authUserId && profile.authUserId !== authUserId) return 'other-account';
  return 'adopt';
}

export type AuthCallback =
  { kind: 'code'; code: string } | { kind: 'error'; message: string } | { kind: 'none' };

/**
 * Reads the address the browser comes back to after Google sign-in, e.g.
 * `dozi://auth/callback?code=…` or `…#error=access_denied&error_description=…`.
 */
export function parseAuthCallback(url: string): AuthCallback {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'none' };
  }
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  new URLSearchParams(hash).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { kind: 'error', message: error.replace(/\+/g, ' ') };
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'none' };
}

/**
 * The phone's secure store only promises ~2 KB per value, and a Supabase session is often bigger,
 * so it is saved in pieces. 1800 characters leaves room for multi-byte characters.
 */
export const SECURE_CHUNK_SIZE = 1800;

export function splitIntoChunks(value: string, size = SECURE_CHUNK_SIZE): string[] {
  if (size <= 0) throw new Error('chunk size must be positive');
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}

/** The pieces back together, or null if any is missing (then the student just signs in again). */
export function joinChunks(chunks: readonly (string | null)[]): string | null {
  if (chunks.length === 0 || chunks.some((chunk) => chunk === null)) return null;
  return chunks.join('');
}

/** How many saved pieces a stored count says there are (null/garbage → none). */
export function parseChunkCount(raw: string | null): number {
  if (raw === null) return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 1000 ? n : 0;
}

/** Turns Supabase's English error messages into friendly ones for the most common cases. */
export type AuthProblem = 'rate-limited' | 'bad-code' | 'offline' | 'unknown';

export function classifyAuthError(
  error: { message?: string; status?: number } | null,
): AuthProblem {
  const message = (error?.message ?? '').toLowerCase();
  if (
    error?.status === 429 ||
    message.includes('rate limit') ||
    message.includes('security purposes')
  )
    return 'rate-limited';
  if (message.includes('expired') || message.includes('invalid') || message.includes('otp'))
    return 'bad-code';
  if (message.includes('network') || message.includes('fetch')) return 'offline';
  return 'unknown';
}

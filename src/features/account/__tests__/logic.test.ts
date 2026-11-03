import {
  adoptionDecision,
  classifyAuthError,
  cleanCode,
  isValidCode,
  isValidEmail,
  joinChunks,
  normaliseEmail,
  parseAuthCallback,
  parseChunkCount,
  parseSupabaseConfig,
  splitIntoChunks,
} from '../logic';

describe('parseSupabaseConfig', () => {
  it('needs both values', () => {
    expect(parseSupabaseConfig(undefined, 'key')).toBeNull();
    expect(parseSupabaseConfig('https://abc.supabase.co', '')).toBeNull();
    expect(parseSupabaseConfig('  ', ' ')).toBeNull();
  });

  it('only accepts an https project address and drops a trailing path', () => {
    expect(parseSupabaseConfig('http://abc.supabase.co', 'k')).toBeNull();
    expect(parseSupabaseConfig('not a url', 'k')).toBeNull();
    expect(parseSupabaseConfig(' https://abc.supabase.co/ ', ' sb_publishable_x ')).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'sb_publishable_x',
    });
  });
});

describe('email and code', () => {
  it('normalises and checks emails', () => {
    expect(normaliseEmail('  Joe@Mail.COM ')).toBe('joe@mail.com');
    expect(isValidEmail('joe@mail.com')).toBe(true);
    expect(isValidEmail('joe@mail')).toBe(false);
    expect(isValidEmail('joe mail.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('keeps only digits and accepts 6 to 10 of them', () => {
    expect(cleanCode(' 123-456 ')).toBe('123456');
    expect(isValidCode('123 456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('12345678')).toBe(true);
    expect(isValidCode('12345678901')).toBe(false);
  });
});

describe('adoptionDecision', () => {
  it('adopts on the first sign-in', () => {
    expect(adoptionDecision({ id: 'device-1', authUserId: null }, 'user-a')).toBe('adopt');
  });

  it('does nothing when the study is already this account’s', () => {
    expect(adoptionDecision({ id: 'user-a', authUserId: 'user-a' }, 'user-a')).toBe(
      'already-adopted',
    );
  });

  it('refuses to mix in another account’s study', () => {
    expect(adoptionDecision({ id: 'user-a', authUserId: 'user-a' }, 'user-b')).toBe(
      'other-account',
    );
  });
});

describe('parseAuthCallback', () => {
  it('finds the code', () => {
    expect(parseAuthCallback('dozi://auth/callback?code=abc-123')).toEqual({
      kind: 'code',
      code: 'abc-123',
    });
    expect(parseAuthCallback('exp://192.168.1.5:8081/--/auth/callback?code=xyz')).toEqual({
      kind: 'code',
      code: 'xyz',
    });
  });

  it('reports an error from the query or the fragment', () => {
    expect(
      parseAuthCallback(
        'dozi://auth/callback#error=access_denied&error_description=User+cancelled',
      ),
    ).toEqual({ kind: 'error', message: 'User cancelled' });
    expect(parseAuthCallback('dozi://auth/callback?error=server_error')).toEqual({
      kind: 'error',
      message: 'server_error',
    });
  });

  it('copes with nothing useful', () => {
    expect(parseAuthCallback('dozi://auth/callback')).toEqual({ kind: 'none' });
    expect(parseAuthCallback('::::')).toEqual({ kind: 'none' });
  });
});

describe('secure store chunks', () => {
  it('splits and joins back to the same text', () => {
    const value = 'x'.repeat(4000) + '✓';
    const chunks = splitIntoChunks(value, 1800);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length <= 1800)).toBe(true);
    expect(joinChunks(chunks)).toBe(value);
  });

  it('keeps an empty value as one empty piece', () => {
    expect(splitIntoChunks('')).toEqual(['']);
    expect(joinChunks([''])).toBe('');
  });

  it('gives null when a piece is missing', () => {
    expect(joinChunks(['a', null, 'c'])).toBeNull();
    expect(joinChunks([])).toBeNull();
  });

  it('reads the stored count safely', () => {
    expect(parseChunkCount(null)).toBe(0);
    expect(parseChunkCount('3')).toBe(3);
    expect(parseChunkCount('abc')).toBe(0);
    expect(parseChunkCount('-1')).toBe(0);
    expect(parseChunkCount('2.5')).toBe(0);
  });
});

describe('classifyAuthError', () => {
  it('spots the common problems', () => {
    expect(classifyAuthError({ status: 429, message: 'x' })).toBe('rate-limited');
    expect(
      classifyAuthError({ message: 'For security purposes, you can only request this after 52s' }),
    ).toBe('rate-limited');
    expect(classifyAuthError({ message: 'Token has expired or is invalid' })).toBe('bad-code');
    expect(classifyAuthError({ message: 'Network request failed' })).toBe('offline');
    expect(classifyAuthError({ message: 'Something odd' })).toBe('unknown');
    expect(classifyAuthError(null)).toBe('unknown');
  });
});

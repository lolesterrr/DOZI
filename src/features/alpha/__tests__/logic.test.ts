import {
  formatAlphaExpiry,
  isAlphaExpired,
  parseAlphaExpiry,
  shouldShowAlphaNotice,
} from '../logic';

describe('parseAlphaExpiry', () => {
  it('keeps a real YYYY-MM-DD date', () => {
    expect(parseAlphaExpiry('2026-11-15')).toBe('2026-11-15');
  });

  it('means "no expiry" for anything else', () => {
    expect(parseAlphaExpiry(undefined)).toBeNull();
    expect(parseAlphaExpiry(null)).toBeNull();
    expect(parseAlphaExpiry('')).toBeNull();
    expect(parseAlphaExpiry('15/11/2026')).toBeNull();
    expect(parseAlphaExpiry('2026-02-30')).toBeNull();
    expect(parseAlphaExpiry(20261115)).toBeNull();
  });
});

describe('isAlphaExpired', () => {
  it('never expires without a date', () => {
    expect(isAlphaExpired(null, '2099-01-01T00:00:00Z')).toBe(false);
  });

  it('still works on the day before the expiry date', () => {
    // 23:59 in Kampala (UTC+3) on 14 November.
    expect(isAlphaExpired('2026-11-15', '2026-11-14T20:59:00Z')).toBe(false);
  });

  it('stops from midnight Kampala time on the expiry date', () => {
    // 00:00 in Kampala on 15 November is 21:00 UTC the day before.
    expect(isAlphaExpired('2026-11-15', '2026-11-14T21:00:00Z')).toBe(true);
    expect(isAlphaExpired('2026-11-15', '2026-12-01T12:00:00Z')).toBe(true);
  });
});

describe('formatAlphaExpiry', () => {
  it('writes the date out in full', () => {
    expect(formatAlphaExpiry('2026-11-15')).toBe('Sunday 15 November 2026');
  });
});

describe('shouldShowAlphaNotice', () => {
  it('shows once per expiry date', () => {
    expect(shouldShowAlphaNotice('2026-11-15', undefined)).toBe(true);
    expect(shouldShowAlphaNotice('2026-11-15', { expiresOn: '2026-11-15' })).toBe(false);
    // A newer build with a new date tells the tester again.
    expect(shouldShowAlphaNotice('2026-11-29', { expiresOn: '2026-11-15' })).toBe(true);
  });

  it('never shows in builds that don’t expire', () => {
    expect(shouldShowAlphaNotice(null, undefined)).toBe(false);
  });
});

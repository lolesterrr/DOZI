import { format, parseISO } from 'date-fns';

import { DEFAULT_TIMEZONE, isDayString, localDate, type DayString, type Instant } from '@/lib/time';

// The alpha expiry: a shared test build stops opening on a date fixed when it is built (see
// app.config.js). Builds without a date (Expo Go, the dev build, tests) never expire.

/** The settings key that remembers which expiry date the tester has already been told about. */
export const ALPHA_NOTICE_SETTING = 'alpha_expiry_notice';

/** The expiry date if `raw` is a real `YYYY-MM-DD` date, otherwise null (no expiry). */
export function parseAlphaExpiry(raw: unknown): DayString | null {
  return typeof raw === 'string' && isDayString(raw) ? raw : null;
}

/** True from the start of the expiry date (Kampala time) onwards. */
export function isAlphaExpired(
  expiresOn: DayString | null,
  now: Instant,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  if (!expiresOn) return false;
  return localDate(now, timeZone) >= expiresOn;
}

/** The expiry date for people, e.g. "Sunday 15 November 2026". */
export function formatAlphaExpiry(expiresOn: DayString): string {
  return format(parseISO(expiresOn), 'EEEE d MMMM yyyy');
}

/** Show the notice unless the tester already saw it for this same expiry date. */
export function shouldShowAlphaNotice(expiresOn: DayString | null, seen: unknown): boolean {
  if (!expiresOn) return false;
  const seenOn =
    seen && typeof seen === 'object' && 'expiresOn' in seen
      ? (seen as { expiresOn: unknown }).expiresOn
      : null;
  return seenOn !== expiresOn;
}

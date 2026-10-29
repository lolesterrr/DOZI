// The alpha feedback link (task 2.10): the address of a feedback form (for example a Google
// Form), set at build time as EXPO_PUBLIC_FEEDBACK_URL in `.env` or in the EAS build's
// environment. Nothing is shown when it isn't set or isn't a safe web address.

/** The address if it is a plain https link, otherwise null. */
export function parseFeedbackUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The configured feedback form, or null. (Expo replaces `process.env.EXPO_PUBLIC_*` at build.) */
export function feedbackUrl(): string | null {
  return parseFeedbackUrl(process.env.EXPO_PUBLIC_FEEDBACK_URL);
}

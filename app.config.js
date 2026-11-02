// Expo reads app.json first and passes it here as `config`. This file only adds the alpha
// expiry date (src/features/alpha), which has to be worked out when the app is built.
//
// - `preview` builds (the APK shared with testers) stop working ALPHA_DAYS days after the build
//   date, counted in Kampala time.
// - To pick the date yourself, set ALPHA_EXPIRES_ON=YYYY-MM-DD for the build (for example under
//   "env" of the preview profile in eas.json). ALPHA_EXPIRES_ON=off turns the expiry off.
// - Everything else (Expo Go, the dev build, tests) never expires.

const ALPHA_DAYS = 14;

/** Today's date in Kampala as YYYY-MM-DD. */
function kampalaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

/** `day` (YYYY-MM-DD) plus `days` calendar days. */
function addDays(day, days) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function alphaExpiresOn() {
  const chosen = process.env.ALPHA_EXPIRES_ON?.trim();
  if (chosen === 'off') return null;
  if (chosen) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chosen)) {
      throw new Error(`ALPHA_EXPIRES_ON must be YYYY-MM-DD or "off", not "${chosen}"`);
    }
    return chosen;
  }
  if (['preview', 'preview-local'].includes(process.env.EAS_BUILD_PROFILE ?? '')) return addDays(kampalaToday(), ALPHA_DAYS);
  return null;
}

module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, alphaExpiresOn: alphaExpiresOn() },
});

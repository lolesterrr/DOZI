import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/db/DatabaseProvider';
import { getSetting, setSetting } from '@/features/settings/repo';
import { createLogger } from '@/lib/logger';
import { nowIso } from '@/lib/time';

import { alphaExpiresOn } from './config';
import { ALPHA_NOTICE_SETTING, isAlphaExpired, shouldShowAlphaNotice } from './logic';

const log = createLogger('alpha');

/** True once this alpha build has expired. Checked at launch and each time the app comes back. */
export function useAlphaExpired(): boolean {
  const expiresOn = alphaExpiresOn();
  const [expired, setExpired] = useState(() => isAlphaExpired(expiresOn, nowIso()));
  useEffect(() => {
    if (!expiresOn) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAlphaExpired(expiresOn, nowIso())) setExpired(true);
    });
    return () => subscription.remove();
  }, [expiresOn]);
  return expired;
}

/** Whether to show the "this alpha runs for 2 weeks" notice, and a way to dismiss it for good. */
export function useAlphaNotice() {
  const db = useDatabase();
  const expiresOn = alphaExpiresOn();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!expiresOn) return;
    let active = true;
    getSetting(db, ALPHA_NOTICE_SETTING)
      .then((seen) => active && setVisible(shouldShowAlphaNotice(expiresOn, seen)))
      .catch((error: unknown) => {
        log.warn('Could not read the alpha notice setting', { error: String(error) });
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, [db, expiresOn]);
  const dismiss = () => {
    setVisible(false);
    if (!expiresOn) return;
    setSetting(db, ALPHA_NOTICE_SETTING, { expiresOn, at: nowIso() }).catch((error: unknown) =>
      log.warn('Could not save the alpha notice setting', { error: String(error) }),
    );
  };
  return { visible, expiresOn, dismiss };
}

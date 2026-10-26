import { strings } from '@/i18n/strings';

import { exportToast } from '../messages';

describe('exportToast', () => {
  it('says nothing when the share sheet opened without notes', () => {
    expect(exportToast({ status: 'shared', notes: [] })).toBeNull();
  });

  it('explains a failure, with the failed step in development builds', () => {
    expect(exportToast({ status: 'failed', detail: 'share: busy' })).toEqual({
      message: `${strings.transfer.failed} (share: busy)`,
      tone: 'error',
    });
  });

  it('says when sharing is not available', () => {
    expect(exportToast({ status: 'unavailable' })).toEqual({
      message: strings.transfer.shareUnavailable,
      tone: 'error',
    });
  });
});

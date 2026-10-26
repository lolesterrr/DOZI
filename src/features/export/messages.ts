import type { ToastOptions } from '@/components/ui';
import { strings } from '@/i18n/strings';

import type { ExportResult } from './hooks';

/** The toast after an export, if any (when sharing worked, the share sheet says enough). */
export function exportToast(result: ExportResult): ToastOptions | null {
  if (result.status === 'nothing') return { message: result.message };
  if (result.status === 'unavailable')
    return { message: strings.transfer.shareUnavailable, tone: 'error' };
  if (result.status === 'failed') {
    // In development builds, say which step failed and why, so a bug report can include it.
    const detail = __DEV__ ? ` (${result.detail})` : '';
    return { message: `${strings.transfer.failed}${detail}`, tone: 'error' };
  }
  return result.notes.length > 0 ? { message: result.notes.join(' ') } : null;
}

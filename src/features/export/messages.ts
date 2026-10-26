import type { ToastOptions } from '@/components/ui';
import { strings } from '@/i18n/strings';

import type { ExportResult } from './hooks';

/** The toast after an export, if any (when sharing worked, the share sheet says enough). */
export function exportToast(result: ExportResult): ToastOptions | null {
  if (result.status === 'nothing') return { message: result.message };
  if (result.status === 'unavailable')
    return { message: strings.transfer.shareUnavailable, tone: 'error' };
  return result.notes.length > 0 ? { message: result.notes.join(' ') } : null;
}

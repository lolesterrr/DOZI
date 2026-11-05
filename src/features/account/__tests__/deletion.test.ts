import { createTestDatabase } from '@/test-utils/db';

import { deleteAccount, keepAccount } from '../auth';
import {
  getDeletionState,
  refreshDeletionStatus,
  resetDeletionForTests,
  setDeletionPending,
} from '../deletion';
import { ensureProfile } from '@/features/profile/repo';
import { profiles } from '@/db/schema';

// Task 3.6: deleting an account waits 10 days and can be undone.

const mockRpc = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { signOut: (...args: unknown[]) => mockSignOut(...args) },
  },
  isSupabaseConfigured: true,
}));

const USER = '00000000-0000-4000-a000-00000000000a';

beforeEach(() => {
  jest.clearAllMocks();
  resetDeletionForTests();
});

async function signedInPhone() {
  const db = createTestDatabase();
  await ensureProfile(db, { newId: () => USER });
  db.update(profiles).set({ authUserId: USER }).run();
  return db;
}

describe('deleteAccount', () => {
  it('asks the server to delete in 10 days, lets go of the account and signs out', async () => {
    const db = await signedInPhone();
    mockRpc.mockResolvedValue({ data: '2026-11-15T12:00:00+00:00', error: null });

    expect(await deleteAccount(db)).toEqual({ ok: true, purgeAfter: '2026-11-15T12:00:00+00:00' });
    expect(mockRpc).toHaveBeenCalledWith('request_account_deletion');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(db.select().from(profiles).get()).toMatchObject({ id: USER, authUserId: null });
  });

  it('changes nothing when the request fails', async () => {
    const db = await signedInPhone();
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Network request failed' },
    });

    expect(await deleteAccount(db)).toEqual({ ok: false, problem: 'offline' });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(db.select().from(profiles).get()).toMatchObject({ authUserId: USER });
  });
});

describe('pending deletions', () => {
  it('reads the status for the signed-in account', async () => {
    mockRpc.mockResolvedValue({ data: '2026-11-15T12:00:00+00:00', error: null });
    await refreshDeletionStatus(USER);
    expect(getDeletionState()).toEqual({ userId: USER, purgeAfter: '2026-11-15T12:00:00+00:00' });
  });

  it('keeps the last known status when offline', async () => {
    setDeletionPending(USER, '2026-11-15T12:00:00+00:00');
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
    await refreshDeletionStatus(USER);
    expect(getDeletionState().purgeAfter).toBe('2026-11-15T12:00:00+00:00');
  });

  it('“Keep my account” cancels the deletion', async () => {
    setDeletionPending(USER, '2026-11-15T12:00:00+00:00');
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await keepAccount(USER)).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith('cancel_account_deletion');
    expect(getDeletionState()).toEqual({ userId: USER, purgeAfter: null });
  });
});

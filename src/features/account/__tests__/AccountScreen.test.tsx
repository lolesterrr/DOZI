import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { AccountScreen } from '../components/AccountScreen';

const s = strings.account;

const mockAuth = {
  session: null as null | { user: { id: string; email: string } },
  sendEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  keepAccount: jest.fn(),
  pendingDeletion: null as string | null,
};

jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: () => ({}) }));
jest.mock('@/features/profile/hooks', () => ({
  useProfile: () => ({ profile: { id: 'user-a' } }),
}));
jest.mock('../repo', () => ({ countUnsyncedChanges: async () => 3 }));
jest.mock('@/features/media/hooks', () => ({ useUploadCounts: () => ({ waiting: 0, failed: 0 }) }));
jest.mock('../auth', () => ({
  useAuthSession: () => ({ session: mockAuth.session, loading: false }),
  sendEmailCode: (...args: unknown[]) => mockAuth.sendEmailCode(...args),
  verifyEmailCode: (...args: unknown[]) => mockAuth.verifyEmailCode(...args),
  signInWithGoogle: (...args: unknown[]) => mockAuth.signInWithGoogle(...args),
  signOut: (...args: unknown[]) => mockAuth.signOut(...args),
  deleteAccount: (...args: unknown[]) => mockAuth.deleteAccount(...args),
  keepAccount: (...args: unknown[]) => mockAuth.keepAccount(...args),
}));
jest.mock('../deletion', () => ({ useAccountDeletion: () => mockAuth.pendingDeletion }));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn() },
}));

beforeEach(() => {
  mockAuth.session = null;
  mockAuth.pendingDeletion = null;
  jest.clearAllMocks();
});

describe('AccountScreen', () => {
  it('checks the email before sending a code', async () => {
    await renderWithProviders(<AccountScreen />);
    await fireEvent.changeText(screen.getByLabelText(s.emailLabel), 'not-an-email');
    await fireEvent.press(screen.getByText(s.sendCode));
    expect(await screen.findByText(s.emailInvalid)).toBeTruthy();
    expect(mockAuth.sendEmailCode).not.toHaveBeenCalled();
  });

  it('sends a code, then signs in with it', async () => {
    mockAuth.sendEmailCode.mockResolvedValue({ ok: true });
    mockAuth.verifyEmailCode.mockResolvedValue({ ok: true });
    await renderWithProviders(<AccountScreen />);

    await fireEvent.changeText(screen.getByLabelText(s.emailLabel), ' Joe@Example.com ');
    await fireEvent.press(screen.getByText(s.sendCode));
    expect(await screen.findByText(s.codeSentTo('joe@example.com'))).toBeTruthy();
    expect(mockAuth.sendEmailCode).toHaveBeenCalledWith(' Joe@Example.com ');

    await fireEvent.changeText(screen.getByLabelText(s.codeLabel), '123 456');
    await fireEvent.press(screen.getByText(s.verify));
    await waitFor(() =>
      expect(mockAuth.verifyEmailCode).toHaveBeenCalledWith({}, 'joe@example.com', '123 456'),
    );
    expect(await screen.findByText(s.signedIn)).toBeTruthy();
  });

  it('explains a failed code in plain words', async () => {
    mockAuth.sendEmailCode.mockResolvedValue({ ok: true });
    mockAuth.verifyEmailCode.mockResolvedValue({ ok: false, problem: 'bad-code' });
    await renderWithProviders(<AccountScreen />);
    await fireEvent.changeText(screen.getByLabelText(s.emailLabel), 'joe@example.com');
    await fireEvent.press(screen.getByText(s.sendCode));
    await fireEvent.changeText(await screen.findByLabelText(s.codeLabel), '000000');
    await fireEvent.press(screen.getByText(s.verify));
    expect(await screen.findByText(s.problems['bad-code'])).toBeTruthy();
  });

  it('shows who is signed in', async () => {
    mockAuth.session = { user: { id: 'user-a', email: 'joe@example.com' } };
    await renderWithProviders(<AccountScreen />);
    expect(screen.getByText(s.signedInAs('joe@example.com'))).toBeTruthy();
    expect(screen.getByText(s.signOut)).toBeTruthy();
  });

  it('deletes the account only after the student confirms', async () => {
    mockAuth.session = { user: { id: 'user-a', email: 'joe@example.com' } };
    mockAuth.deleteAccount.mockResolvedValue({ ok: true, purgeAfter: '2026-11-15T12:00:00.000Z' });
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithProviders(<AccountScreen />);

    await fireEvent.press(screen.getByRole('button', { name: s.deleteButton }));
    expect(alert).toHaveBeenCalledWith(
      s.deleteConfirmTitle,
      s.deleteConfirmMessage,
      expect.any(Array),
    );
    expect(mockAuth.deleteAccount).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    await buttons.find((b) => b.text === s.deleteConfirm)?.onPress?.();
    expect(mockAuth.deleteAccount).toHaveBeenCalledWith({});
    expect(await screen.findByText(s.deleted('15 Nov 2026'))).toBeTruthy();
  });

  it('explains when deleting fails', async () => {
    mockAuth.session = { user: { id: 'user-a', email: 'joe@example.com' } };
    mockAuth.deleteAccount.mockResolvedValue({ ok: false, problem: 'offline' });
    const alert = jest.spyOn(Alert, 'alert');
    await renderWithProviders(<AccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: s.deleteButton }));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    await buttons.find((b) => b.text === s.deleteConfirm)?.onPress?.();
    expect(await screen.findByText(s.deleteProblems.offline)).toBeTruthy();
  });

  it('offers to keep an account that is waiting to be deleted', async () => {
    mockAuth.session = { user: { id: 'user-a', email: 'joe@example.com' } };
    mockAuth.pendingDeletion = '2026-11-15T12:00:00.000Z';
    mockAuth.keepAccount.mockResolvedValue({ ok: true });
    await renderWithProviders(<AccountScreen />);

    expect(screen.getByText(s.pendingMessage('15 Nov 2026'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: s.deleteButton })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: s.keep }));
    expect(mockAuth.keepAccount).toHaveBeenCalledWith('user-a');
    expect(await screen.findByText(s.kept)).toBeTruthy();
  });
});

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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
}));

beforeEach(() => {
  mockAuth.session = null;
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
});

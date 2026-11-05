import { format, parseISO } from 'date-fns';
import { CircleCheck, Clock, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Button, Card, Input, Text, useToast } from '@/components/ui';
import { useDatabase } from '@/db/DatabaseProvider';
import { useProfile } from '@/features/profile/hooks';
import { SyncStatusCard } from '@/features/sync/components/SyncStatusCard';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import {
  deleteAccount,
  keepAccount,
  sendEmailCode,
  signInWithGoogle,
  signOut,
  useAuthSession,
  verifyEmailCode,
  type AuthResult,
} from '../auth';
import { useAccountDeletion } from '../deletion';
import { isValidCode, isValidEmail, normaliseEmail } from '../logic';
import { countUnsyncedChanges } from '../repo';

const s = strings.account;

type Busy = 'send' | 'verify' | 'google' | 'signout' | 'delete' | 'keep' | null;

const day = (iso: string) => format(parseISO(iso), 'd MMM yyyy');

/** Me → Account: optional sign-in with an emailed code or Google, and sign-out. */
export function AccountScreen() {
  const { session, loading } = useAuthSession();
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {loading ? null : session ? (
          <SignedIn email={session.user.email ?? ''} userId={session.user.id} />
        ) : (
          <SignedOut />
        )}
        <Button label={s.privacyLink} variant="ghost" onPress={() => router.push('/privacy')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useProblemToast() {
  const toast = useToast();
  return (result: AuthResult) => {
    if (!result.ok) toast.show({ message: s.problems[result.problem], tone: 'error' });
    return result.ok;
  };
}

function SignedOut() {
  const db = useDatabase();
  const toast = useToast();
  const report = useProblemToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [busy, setBusy] = useState<Busy>(null);

  const send = async () => {
    if (!isValidEmail(email)) {
      setEmailError(s.emailInvalid);
      return;
    }
    setEmailError(undefined);
    setBusy('send');
    const result = await sendEmailCode(email);
    setBusy(null);
    if (report(result)) {
      setSentTo(normaliseEmail(email));
      setCode('');
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    if (!isValidCode(code)) {
      setCodeError(s.codeInvalid);
      return;
    }
    setCodeError(undefined);
    setBusy('verify');
    const result = await verifyEmailCode(db, sentTo, code);
    setBusy(null);
    if (report(result)) toast.show({ message: s.signedIn, tone: 'success' });
  };

  const google = async () => {
    setBusy('google');
    const result = await signInWithGoogle(db);
    setBusy(null);
    if (result.ok) toast.show({ message: s.signedIn, tone: 'success' });
    else report(result);
  };

  return (
    <>
      <View className="gap-2">
        <Text>{s.intro}</Text>
        <Text variant="small" tone="muted">
          {s.keepsStudy}
        </Text>
      </View>

      {sentTo === null ? (
        <Card className="gap-4">
          <Input
            label={s.emailLabel}
            placeholder={s.emailPlaceholder}
            value={email}
            onChangeText={setEmail}
            error={emailError}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <Button
            label={s.sendCode}
            icon={Mail}
            loading={busy === 'send'}
            disabled={busy !== null}
            onPress={send}
          />
        </Card>
      ) : (
        <Card className="gap-4">
          <Text variant="small" tone="muted">
            {s.codeSentTo(sentTo)}
          </Text>
          <Input
            label={s.codeLabel}
            value={code}
            onChangeText={setCode}
            error={codeError}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={12}
            returnKeyType="done"
            onSubmitEditing={verify}
          />
          <Button
            label={s.verify}
            loading={busy === 'verify'}
            disabled={busy !== null}
            onPress={verify}
          />
          <View className="flex-row flex-wrap gap-2">
            <Button label={s.resend} variant="ghost" disabled={busy !== null} onPress={send} />
            <Button
              label={s.changeEmail}
              variant="ghost"
              disabled={busy !== null}
              onPress={() => setSentTo(null)}
            />
          </View>
        </Card>
      )}

      <Text variant="small" tone="muted" className="text-center">
        {s.or}
      </Text>
      <Button
        label={s.google}
        variant="outline"
        loading={busy === 'google'}
        disabled={busy !== null}
        onPress={google}
      />
    </>
  );
}

function SignedIn({ email, userId }: { email: string; userId: string }) {
  const db = useDatabase();
  const toast = useToast();
  const { colors } = useTheme();
  const ownerId = useProfile().profile?.id ?? '';
  const [busy, setBusy] = useState<Busy>(null);
  const pendingDeletion = useAccountDeletion(userId);

  const keep = async () => {
    setBusy('keep');
    const result = await keepAccount(userId);
    setBusy(null);
    if (result.ok) toast.show({ message: s.kept, tone: 'success' });
    else toast.show({ message: s.keepProblems[result.problem], tone: 'error' });
  };

  const confirmSignOut = async () => {
    const changes = ownerId ? await countUnsyncedChanges(db, ownerId) : 0;
    Alert.alert(s.signOutTitle, s.signOutMessage(changes), [
      { text: s.signOutCancel, style: 'cancel' },
      {
        text: s.signOutConfirm,
        style: 'destructive',
        onPress: async () => {
          setBusy('signout');
          await signOut();
          setBusy(null);
          toast.show({ message: s.signedOut });
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(s.deleteConfirmTitle, s.deleteConfirmMessage, [
      { text: s.deleteCancel, style: 'cancel' },
      {
        text: s.deleteConfirm,
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          const result = await deleteAccount(db);
          setBusy(null);
          if (result.ok)
            toast.show({ message: s.deleted(day(result.purgeAfter)), tone: 'success' });
          else toast.show({ message: s.deleteProblems[result.problem], tone: 'error' });
        },
      },
    ]);
  };

  return (
    <>
      <Card className="gap-3">
        <View className="flex-row items-center gap-3" accessible>
          <CircleCheck color={colors.success} size={28} />
          <View className="flex-1">
            <Text variant="bodyStrong">{s.signedInTitle}</Text>
            <Text variant="small" tone="muted">
              {s.signedInAs(email)}
            </Text>
          </View>
        </View>
        <Text variant="small" tone="muted">
          {s.signedInNote}
        </Text>
      </Card>
      {pendingDeletion ? (
        <Card layer="accent" className="gap-3">
          <View className="flex-row items-center gap-3" accessible>
            <Clock color={colors.primary} size={26} />
            <View className="flex-1">
              <Text variant="bodyStrong">{s.pendingTitle}</Text>
              <Text variant="small" tone="muted">
                {s.pendingMessage(day(pendingDeletion))}
              </Text>
            </View>
          </View>
          <Button
            label={s.keep}
            loading={busy === 'keep'}
            disabled={busy !== null}
            onPress={keep}
          />
        </Card>
      ) : (
        <SyncStatusCard />
      )}
      <Button
        label={s.signOut}
        variant="outline"
        loading={busy === 'signout'}
        disabled={busy !== null}
        onPress={confirmSignOut}
      />
      {pendingDeletion ? null : (
        <Card className="gap-3">
          <Text variant="bodyStrong">{s.deleteTitle}</Text>
          <Text variant="small" tone="muted">
            {s.deleteHelp}
          </Text>
          <Button
            label={s.deleteButton}
            variant="danger"
            loading={busy === 'delete'}
            disabled={busy !== null}
            onPress={confirmDelete}
          />
        </Card>
      )}
    </>
  );
}

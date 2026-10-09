import { router } from 'expo-router';
import { Ban, MoonStar, MoreVertical, Pencil, Undo2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  EmptyState,
  IconButton,
  ProgressBar,
  Text,
  useToast,
} from '@/components/ui';
import type { ReviewScope } from '@/features/srs/repo';
import { openCardEditor } from '@/features/decks/navigation';
import { cardToDraft, instanceFaces } from '@/features/decks/logic';
import { SheetAction } from '@/features/library/components/SheetAction';
import { Dozi } from '@/features/mascot';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useReviewSession, type ReviewSession, type UndoAction } from '../hooks';
import { checkTypedAnswer, sessionProgress, summariseSession, type ReviewMode } from '../logic';
import type { ReviewItem } from '../repo';
import { RatingBar } from './RatingBar';
import { ReviewCardView } from './ReviewCardView';
import { SessionSummary } from './SessionSummary';

const s = strings.review;
const log = createLogger('review');

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/practice');
}

/** The review session route: `/review/all` or `/review/<deck id>`, `?mode=cram` to cram. */
export function ReviewScreen({ scope, mode }: { scope: ReviewScope; mode: ReviewMode }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const session = useReviewSession(scope, mode);
  const [sheet, setSheet] = useState(false);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Review action failed', { error: String(error) });
      toast.show({ message: s.failed, tone: 'error' });
    }
  };

  const withUndo = (message: string, action: () => Promise<UndoAction | null>) =>
    run(async () => {
      setSheet(false);
      const undo = await action();
      if (!undo) return;
      toast.show({
        message,
        actionLabel: s.undoAction,
        onAction: () => void run(undo),
      });
    });

  const progress = sessionProgress(session.answers.length, session.remaining);
  const counts = session.counts;

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center gap-1 px-1">
          <IconButton icon={X} accessibilityLabel={s.close} onPress={close} />
          <View className="flex-1 px-2">
            <ProgressBar value={progress} accessibilityLabel={s.progress} />
          </View>
          <IconButton
            icon={Undo2}
            accessibilityLabel={s.undo}
            disabled={!session.canUndo || session.busy}
            onPress={() =>
              void run(async () => {
                await session.undo();
                toast.show({ message: s.undone });
              })
            }
          />
          <IconButton
            icon={MoreVertical}
            accessibilityLabel={s.moreOptions}
            disabled={session.status !== 'studying'}
            onPress={() => setSheet(true)}
          />
        </View>

        {session.status === 'studying' ? (
          <Text variant="caption" tone="muted" className="px-4 pb-2 text-center">
            {mode === 'cram' || !counts
              ? s.cramLeft(session.remaining)
              : s.counts(counts.new, counts.learning, counts.review)}
          </Text>
        ) : null}

        {session.status === 'loading' ? <View className="flex-1" /> : null}

        {session.status === 'studying' && session.item ? (
          <StudyCard
            key={session.item.instanceId}
            item={session.item}
            session={session}
            showDeck={scope === 'all'}
            onRate={(rating) => void run(() => session.answer(rating))}
          />
        ) : null}

        {session.status === 'finished' ? (
          <SessionSummary
            summary={summariseSession(session.answers)}
            mode={mode}
            nextLearningDue={session.nextLearningDue}
            now={session.loadedAt}
            onCheckAgain={() => void run(session.reload)}
            onDone={close}
          />
        ) : null}

        {session.status === 'empty' ? (
          <View className="flex-1 justify-center">
            <EmptyState
              illustration={<Dozi mood={mode === 'cram' ? 'thinking' : 'celebrating'} />}
              title={mode === 'cram' ? s.emptyCram.title : s.empty.title}
              message={mode === 'cram' ? s.emptyCram.message : s.empty.message}
              actionLabel={s.empty.back}
              onAction={close}
            />
            {mode === 'review' && scope !== 'all' ? (
              <View className="items-center">
                <Button
                  label={s.empty.cram}
                  variant="outline"
                  onPress={() =>
                    router.replace({
                      pathname: '/review/[scope]',
                      params: { scope: scope.deckId, mode: 'cram' },
                    })
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title={s.moreOptions}>
        <View className="pb-2">
          <SheetAction
            icon={Pencil}
            label={s.actions.edit}
            onPress={() => {
              setSheet(false);
              const item = session.item;
              if (item) openCardEditor(item.deckId, item.card.id);
            }}
          />
          <SheetAction
            icon={MoonStar}
            label={s.actions.bury}
            onPress={() => void withUndo(s.buried, session.bury)}
          />
          <SheetAction
            icon={Ban}
            label={s.actions.suspend}
            onPress={() => void withUndo(s.suspended, session.suspend)}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

/** The card on screen and the buttons under it. Remounted for each card (fresh typing box). */
function StudyCard({
  item,
  session,
  showDeck,
  onRate,
}: {
  item: ReviewItem;
  session: ReviewSession;
  showDeck: boolean;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
}) {
  const [typed, setTyped] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  const draft = useMemo(() => cardToDraft(item.card), [item.card]);
  const faces = useMemo(
    () => (draft ? instanceFaces(draft, item.subKey) : null),
    [draft, item.subKey],
  );
  const isTypeIn = draft?.type === 'type_in';
  const check = useMemo(
    () => (isTypeIn && session.revealed && draft ? checkTypedAnswer(draft.back.text, typed) : null),
    [isTypeIn, session.revealed, draft, typed],
  );

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-4 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <ReviewCardView
          faces={faces}
          answerReplacesQuestion={draft?.type === 'cloze'}
          revealed={session.revealed}
          deckTitle={showDeck ? item.deckTitle : undefined}
          onImagePress={setViewing}
          typeIn={
            isTypeIn
              ? { value: typed, onChange: setTyped, onSubmit: session.reveal, check }
              : undefined
          }
        />
        {session.mode === 'cram' && !session.revealed ? (
          <Text variant="caption" tone="muted" className="pt-3 text-center">
            {s.cramHint}
          </Text>
        ) : null}
      </ScrollView>

      <View className="border-t border-border bg-surface px-4 pb-3 pt-3">
        {session.revealed ? (
          <RatingBar intervals={session.intervals} disabled={session.busy} onRate={onRate} />
        ) : (
          <Button
            label={isTypeIn ? s.check : s.showAnswer}
            size="lg"
            fullWidth
            onPress={session.reveal}
          />
        )}
      </View>

      <MediaViewer id={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

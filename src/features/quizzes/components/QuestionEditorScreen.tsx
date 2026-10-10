import { router } from 'expo-router';
import { ArrowLeft, Camera, FileX, Images, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, Chip, EmptyState, IconButton, Text, useToast } from '@/components/ui';
import type { Question, QuestionType, Quiz } from '@/db/schema';
import { FieldEditor } from '@/features/decks/components/FieldEditor';
import type { CardField } from '@/features/decks/logic';
import { SheetAction } from '@/features/library/components/SheetAction';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { useAddImage, useDeleteMedia } from '@/features/media/hooks';
import type { ImageSourceKind } from '@/features/media/pipeline';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useQuestion, useQuiz, useQuizActions } from '../hooks';
import {
  changeQuestionType,
  difficulties,
  emptyQuestionDraft,
  isQuestionType,
  questionDraftProblem,
  questionMediaIds,
  questionToDraft,
  questionTypes,
  type QuestionDraft,
} from '../logic';
import { questionProblemMessage } from '../messages';
import {
  BlanksEditor,
  ChoicesEditor,
  PairsEditor,
  SaqEditor,
  StatementsEditor,
} from './PayloadEditors';

const s = strings.questions;
const log = createLogger('quizzes');

/** `questionId` "new" writes a new question. */
export const NEW_QUESTION_ID = 'new';

function goBack(quizId: string | undefined) {
  if (router.canGoBack()) router.back();
  else if (quizId) router.replace({ pathname: '/quiz/[id]/edit', params: { id: quizId } });
  else router.replace('/questions');
}

export type QuestionEditorScreenProps = {
  questionId: string;
  /** A new question is added to this quiz when saved. */
  quizId?: string;
  /** The type a new question starts as. */
  type?: string;
};

/** The question editor route: loads the question (and quiz), then shows the form. */
export function QuestionEditorScreen({ questionId, quizId, type }: QuestionEditorScreenProps) {
  const isNew = questionId === NEW_QUESTION_ID;
  const { question, loading: questionLoading } = useQuestion(isNew ? '' : questionId);
  const { quiz, loading: quizLoading } = useQuiz(quizId ?? '');

  if ((!isNew && questionLoading) || (quizId && quizLoading)) {
    return <View className="flex-1 bg-background" />;
  }
  if (isNew && quizId && (!quiz || quiz.deletedAt)) {
    return (
      <Problem
        title={strings.quizzes.missingTitle}
        message={strings.quizzes.missingMessage}
        back={() => router.replace('/library')}
      />
    );
  }
  if (!isNew && (!question || question.deletedAt)) {
    return (
      <Problem title={s.missingTitle} message={s.missingMessage} back={() => goBack(quizId)} />
    );
  }
  const draft = question
    ? questionToDraft(question)
    : emptyQuestionDraft(type && isQuestionType(type) ? type : 'sba');
  if (!draft) {
    return <Problem title={s.editTitle} message={s.unreadable} back={() => goBack(quizId)} />;
  }
  return (
    <QuestionForm
      key={question?.id ?? 'new'}
      question={question ?? null}
      quiz={isNew && quiz && !quiz.deletedAt ? quiz : null}
      backQuizId={quizId}
      initialDraft={draft}
    />
  );
}

function Problem({ title, message, back }: { title: string; message: string; back: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
      <EmptyState
        icon={FileX}
        title={title}
        message={message}
        actionLabel={s.back}
        onAction={back}
      />
    </View>
  );
}

type FieldKey = 'stem' | 'explanation';

function QuestionForm({
  question,
  quiz,
  backQuizId,
  initialDraft,
}: {
  question: Question | null;
  /** New questions only: the quiz to add it to. */
  quiz: Quiz | null;
  backQuizId: string | undefined;
  initialDraft: QuestionDraft;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const actions = useQuizActions();
  const addImage = useAddImage();
  const deleteMedia = useDeleteMedia();

  const [draft, setDraft] = useState<QuestionDraft>(initialDraft);
  const [saved, setSaved] = useState<QuestionDraft>(initialDraft);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFor, setImageFor] = useState<FieldKey | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [usedIn, setUsedIn] = useState(0);
  // Images added while this screen is open: dropped again if the question isn't saved with them.
  const addedImages = useRef<string[]>([]);

  const isNew = question === null;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const problem = questionDraftProblem(draft);

  useEffect(() => {
    if (!question) return;
    let active = true;
    actions
      .quizIdsUsingQuestion(question.id)
      .then((ids) => {
        if (active) setUsedIn(ids.length);
      })
      .catch((error: unknown) => log.warn('Counting quizzes failed', { error: String(error) }));
    return () => {
      active = false;
    };
  }, [actions, question]);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.warn('Question change failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const dropUnusedImages = useCallback(
    (kept: QuestionDraft | null) => {
      const keep = new Set(kept ? questionMediaIds(kept) : []);
      const unused = addedImages.current.filter((id) => !keep.has(id));
      addedImages.current = [];
      for (const id of unused) {
        deleteMedia(id).catch((error: unknown) =>
          log.warn('Could not drop an image', { error: String(error) }),
        );
      }
    },
    [deleteMedia],
  );

  const leave = useCallback(() => {
    if (!changed) {
      dropUnusedImages(null);
      goBack(backQuizId);
      return;
    }
    Alert.alert(s.discardTitle, s.discardMessage, [
      { text: s.keepEditing, style: 'cancel' },
      {
        text: s.discard,
        style: 'destructive',
        onPress: () => {
          dropUnusedImages(null);
          goBack(backQuizId);
        },
      },
    ]);
  }, [changed, backQuizId, dropUnusedImages]);

  // Android's back button asks first when there are unsaved changes.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  const setField = (key: FieldKey, field: CardField) =>
    setDraft((current) => ({ ...current, [key]: field }));

  const setType = (type: QuestionType) => setDraft((current) => changeQuestionType(current, type));

  const pickImage = (field: FieldKey, source: ImageSourceKind) =>
    run(async () => {
      setImageFor(null);
      const result = await addImage(source);
      if (result.status === 'saved') {
        addedImages.current.push(result.media.id);
        setDraft((current) => ({
          ...current,
          [field]: { ...current[field], mediaIds: [...current[field].mediaIds, result.media.id] },
        }));
      } else if (result.status === 'permission-denied') {
        toast.show({ message: strings.cards.imageDenied });
      }
    });

  const save = () =>
    run(async () => {
      setTried(true);
      if (problem || saving) return;
      setSaving(true);
      try {
        if (question) await actions.updateQuestion(question.id, draft);
        else if (quiz) await actions.createQuestionInQuiz(quiz.id, draft);
        else await actions.createQuestion(draft);
        dropUnusedImages(draft);
        setSaved(draft);
        toast.show({
          message: question ? s.saved : quiz ? s.added : s.addedToBank,
          tone: 'success',
        });
        goBack(backQuizId);
      } finally {
        setSaving(false);
      }
    });

  const deleteQuestion = () =>
    run(async () => {
      if (!question) return;
      const deletedAt = await actions.deleteQuestion(question.id);
      dropUnusedImages(null);
      goBack(backQuizId);
      toast.show({
        message: s.deleted,
        actionLabel: strings.library.undo,
        onAction: () => void run(() => actions.restoreQuestion(question.id, deletedAt)),
      });
    });

  const typeEditor = (() => {
    switch (draft.type) {
      case 'sba':
      case 'multiple_response':
        return (
          <ChoicesEditor
            single={draft.type === 'sba'}
            options={draft.payload.options}
            onChange={(options) =>
              setDraft((current) => ({ ...current, payload: { options } }) as QuestionDraft)
            }
          />
        );
      case 'mtf':
        return (
          <StatementsEditor
            statements={draft.payload.statements}
            onChange={(statements) =>
              setDraft((current) => ({ ...current, payload: { statements } }) as QuestionDraft)
            }
          />
        );
      case 'fill_blank':
        return (
          <BlanksEditor
            payload={draft.payload}
            onChange={(payload) =>
              setDraft((current) => ({ ...current, payload }) as QuestionDraft)
            }
          />
        );
      case 'matching':
        return (
          <PairsEditor
            pairs={draft.payload.pairs}
            onChange={(pairs) =>
              setDraft((current) => ({ ...current, payload: { pairs } }) as QuestionDraft)
            }
          />
        );
      case 'saq':
        return (
          <SaqEditor
            payload={draft.payload}
            onChange={(payload) =>
              setDraft((current) => ({ ...current, payload }) as QuestionDraft)
            }
          />
        );
    }
  })();

  const fillBlank = draft.type === 'fill_blank';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center gap-1 px-1">
          <IconButton icon={ArrowLeft} accessibilityLabel={s.back} onPress={leave} />
          <View className="flex-1">
            <Text variant="heading" numberOfLines={1}>
              {isNew ? s.newTitle : s.editTitle}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {quiz ? quiz.title : s.bankTitle}
            </Text>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-5 px-4 pb-6 pt-3"
        >
          <View className="gap-2">
            <Text variant="label">{s.typeLabel}</Text>
            {isNew ? (
              <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                {questionTypes.map((type) => (
                  <Chip
                    key={type}
                    label={s.types[type]}
                    selected={draft.type === type}
                    accessibilityRole="radio"
                    onPress={() => setType(type)}
                  />
                ))}
              </View>
            ) : (
              <Text variant="bodyStrong">{s.types[draft.type]}</Text>
            )}
            <Text variant="small" tone="muted">
              {s.typeHints[draft.type]}
            </Text>
            {usedIn > 0 ? (
              <Text variant="small" tone="muted">
                {s.usedInEditing(usedIn)}
              </Text>
            ) : null}
          </View>

          <FieldEditor
            label={fillBlank ? s.stemOptional : s.stem}
            placeholder={fillBlank ? s.stemOptionalPlaceholder : s.stemPlaceholder}
            field={draft.stem}
            onChange={(field) => setField('stem', field)}
            onAddImage={() => setImageFor('stem')}
            onViewImage={setViewing}
            minLines={fillBlank ? 2 : 3}
          />

          {typeEditor}

          <FieldEditor
            label={s.explanation}
            placeholder={s.explanationPlaceholder}
            hint={s.explanationHint}
            field={draft.explanation}
            onChange={(field) => setField('explanation', field)}
            onAddImage={() => setImageFor('explanation')}
            onViewImage={setViewing}
            minLines={2}
          />

          <View className="gap-2">
            <Text variant="label">{s.difficulty}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {difficulties.map((level) => (
                <Chip
                  key={level}
                  label={s.difficulties[level]}
                  selected={draft.difficulty === level}
                  accessibilityRole="radio"
                  onPress={() => setDraft((current) => ({ ...current, difficulty: level }))}
                />
              ))}
            </View>
          </View>

          {question ? (
            <Button
              label={s.deleteQuestion}
              icon={Trash2}
              variant="ghost"
              onPress={() => void deleteQuestion()}
            />
          ) : null}
        </ScrollView>

        <View
          className="gap-2 border-t border-border bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {tried && problem ? (
            <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
              {questionProblemMessage(problem)}
            </Text>
          ) : null}
          <Button label={s.save} loading={saving} onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={imageFor !== null}
        onClose={() => setImageFor(null)}
        title={strings.cards.addImageTitle}
      >
        {imageFor ? (
          <View className="pb-2">
            <SheetAction
              icon={Images}
              label={strings.cards.fromGallery}
              onPress={() => void pickImage(imageFor, 'library')}
            />
            <SheetAction
              icon={Camera}
              label={strings.cards.fromCamera}
              onPress={() => void pickImage(imageFor, 'camera')}
            />
          </View>
        ) : null}
      </BottomSheet>

      <MediaViewer id={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

import { Check, Trash2, X } from 'lucide-react-native';
import { useMemo, useReducer, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, cn, IconButton, Input, Text } from '@/components/ui';
import { fitImage } from '@/features/annotation/logic';
import { MediaImage } from '@/features/media/components/MediaImage';
import { strings } from '@/i18n/strings';

import {
  finishMasks,
  liveMasks,
  MASK_LABEL_MAX,
  maskEditorReducer,
  MAX_MASKS,
  startMaskEditor,
  type Mask,
  type OcclusionDraft,
} from '../logic';
import { boxStyle } from './OcclusionImage';

const s = strings.occlusion;

/** How far from a corner (in screen points) a finger can land and still grab it. */
const HANDLE_REACH = 24;
const HANDLE_SIZE = 20;

export type MaskEditorProps = {
  /** The occlusion being edited, or null when the editor is closed. Needs an image. */
  draft: OcclusionDraft | null;
  /** Leave without keeping the changes. */
  onClose: () => void;
  onDone: (masks: Mask[], nextMask: number) => void;
};

/**
 * Full-screen box editor: drag on the diagram to cover a label, drag a box to move it, drag a
 * selected box's corner to resize it, and give it an optional label or delete it.
 */
export function MaskEditor({ draft, onClose, onDone }: MaskEditorProps) {
  if (!draft?.mediaId) return null;
  return <EditorSession draft={draft} onClose={onClose} onDone={onDone} />;
}

function EditorSession({
  draft,
  onClose,
  onDone,
}: Omit<MaskEditorProps, 'draft'> & { draft: OcclusionDraft }) {
  const [state, dispatch] = useReducer(maskEditorReducer, draft, startMaskEditor);
  const [view, setView] = useState({ width: 0, height: 0 });
  const size = useMemo(
    () => ({ width: draft.width, height: draft.height }),
    [draft.width, draft.height],
  );

  const changed =
    JSON.stringify(finishMasks(state.masks)) !== JSON.stringify(finishMasks(draft.masks));

  const confirmClose = () => {
    if (!changed) return onClose();
    Alert.alert(s.discardTitle, s.discardMessage, [
      { text: s.keepEditing, style: 'cancel' },
      { text: s.discard, style: 'destructive', onPress: onClose },
    ]);
  };

  const fit = fitImage(size, view);
  const shown = { width: size.width * fit.scale, height: size.height * fit.scale };
  const toImage = (x: number, y: number) => ({
    x: shown.width > 0 ? Math.min(1, Math.max(0, (x - fit.offsetX) / shown.width)) : 0,
    y: shown.height > 0 ? Math.min(1, Math.max(0, (y - fit.offsetY) / shown.height)) : 0,
  });
  const reach = {
    x: shown.width > 0 ? HANDLE_REACH / shown.width : 0.05,
    y: shown.height > 0 ? HANDLE_REACH / shown.height : 0.05,
  };

  const pan = Gesture.Pan()
    .withTestId('occlusion-pan')
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onStart((event) => dispatch({ type: 'press', at: toImage(event.x, event.y), reach }))
    .onUpdate((event) => dispatch({ type: 'drag', to: toImage(event.x, event.y) }))
    .onEnd(() => dispatch({ type: 'release' }))
    .onFinalize(() => dispatch({ type: 'cancel' }));

  const masks = liveMasks(state);
  const selectedIndex = state.masks.findIndex((m) => m.id === state.selectedId);
  const selected = selectedIndex >= 0 ? state.masks[selectedIndex] : undefined;

  return (
    <Modal visible onRequestClose={confirmClose} animationType="slide" statusBarTranslucent>
      {/* A Modal is a separate native window, so gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-background">
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <View className="flex-row items-center gap-1 px-1">
              <IconButton icon={X} accessibilityLabel={s.close} onPress={confirmClose} />
              <Text variant="heading" className="flex-1" numberOfLines={1}>
                {s.editorTitle}
              </Text>
              <Button
                label={s.done}
                icon={Check}
                onPress={() => onDone(finishMasks(state.masks), state.nextMask)}
                className="mr-2"
              />
            </View>

            <GestureDetector gesture={pan}>
              <View
                className="flex-1 bg-surface-muted"
                onLayout={(event: LayoutChangeEvent) => {
                  const { width, height } = event.nativeEvent.layout;
                  setView({ width, height });
                }}
                accessible
                accessibilityLabel={s.canvasLabel}
                accessibilityHint={s.canvasHint}
                testID="occlusion-canvas"
              >
                {view.width > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: fit.offsetX,
                      top: fit.offsetY,
                      width: shown.width,
                      height: shown.height,
                    }}
                  >
                    <MediaImage id={draft.mediaId!} contentFit="fill" className="h-full w-full" />
                    {masks.map((mask) => (
                      <MaskBox
                        key={mask.id}
                        mask={mask}
                        number={state.masks.findIndex((m) => m.id === mask.id) + 1}
                        selected={mask.id === state.selectedId}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </GestureDetector>

            <View className="gap-3 border-t border-border bg-surface px-4 pb-3 pt-3">
              {masks.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2" accessibilityRole="radiogroup">
                    {state.masks.map((mask, i) => (
                      <Chip
                        key={mask.id}
                        label={s.selectBox(i + 1, mask.label.trim())}
                        selected={mask.id === state.selectedId}
                        accessibilityRole="radio"
                        onPress={() =>
                          dispatch({
                            type: 'select',
                            id: mask.id === state.selectedId ? null : mask.id,
                          })
                        }
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : null}

              {selected ? (
                <View className="gap-3">
                  <Text variant="label" accessibilityLiveRegion="polite">
                    {s.selected(selectedIndex + 1)}
                  </Text>
                  <Input
                    key={selected.id}
                    label={s.labelLabel}
                    placeholder={s.labelPlaceholder}
                    hint={s.labelHint}
                    value={selected.label}
                    maxLength={MASK_LABEL_MAX}
                    returnKeyType="done"
                    onChangeText={(label) => dispatch({ type: 'label', id: selected.id, label })}
                    onSubmitEditing={() => dispatch({ type: 'select', id: null })}
                  />
                  <View className="flex-row gap-3">
                    <Button
                      label={s.deleteBox}
                      icon={Trash2}
                      variant="outline"
                      className="flex-1"
                      onPress={() => dispatch({ type: 'delete', id: selected.id })}
                    />
                    <Button
                      label={s.deselect}
                      variant="secondary"
                      className="flex-1"
                      onPress={() => dispatch({ type: 'select', id: null })}
                    />
                  </View>
                </View>
              ) : (
                <View className="gap-1">
                  <Text variant="small" tone="muted">
                    {s.help}
                  </Text>
                  <Text
                    variant="label"
                    tone={state.full ? 'danger' : 'default'}
                    accessibilityLiveRegion="polite"
                  >
                    {state.full ? s.full(MAX_MASKS) : s.count(state.masks.length, MAX_MASKS)}
                  </Text>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One box on the editor's diagram. The selected one gets a thick outline and corner handles. */
function MaskBox({ mask, number, selected }: { mask: Mask; number: number; selected: boolean }) {
  return (
    <View
      style={boxStyle(mask)}
      pointerEvents="none"
      className={cn(
        'items-center justify-center rounded-sm bg-primary-soft',
        selected ? 'border-4 border-accent' : 'border-2 border-primary',
      )}
      testID={selected ? 'occlusion-mask-selected' : 'occlusion-mask'}
    >
      <Text
        variant="caption"
        tone="inherit"
        className="font-body-semibold text-on-primary-soft"
        numberOfLines={1}
      >
        {number > 0 ? number : ''}
      </Text>
      {selected
        ? (['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <View
              key={corner}
              className="absolute rounded-full border-2 border-surface bg-accent"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                left: corner[1] === 'l' ? -HANDLE_SIZE / 2 : undefined,
                right: corner[1] === 'r' ? -HANDLE_SIZE / 2 : undefined,
                top: corner[0] === 't' ? -HANDLE_SIZE / 2 : undefined,
                bottom: corner[0] === 'b' ? -HANDLE_SIZE / 2 : undefined,
              }}
            />
          ))
        : null}
    </View>
  );
}

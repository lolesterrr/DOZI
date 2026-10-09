import { Canvas, Group, useImage } from '@shopify/react-native-skia';
import {
  ArrowUpRight,
  Check,
  Circle,
  PenLine,
  Redo2,
  Square,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, cn, IconButton, Input, Text } from '@/components/ui';
import type { Media } from '@/db/schema';
import { deviceMediaStore } from '@/features/media/files';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';
import {
  annotationColourNames,
  annotationColours,
  type AnnotationColourName,
} from '@/theme/tokens';

import { useAnnotationStart, useSaveAnnotation } from '../hooks';
import {
  annotationTools,
  canRedo,
  canUndo,
  drawingReducer,
  fitImage,
  hasChanges,
  minDragFor,
  startDrawing,
  strokeWidthFor,
  toImagePoint,
  visibleShapes,
  type AnnotationTool,
  type Point,
} from '../logic';
import type { AnnotationStart } from '../pipeline';
import { labelFont } from '../render';
import { AnnotationScene } from './AnnotationScene';

const s = strings.annotation;
const log = createLogger('annotation');

const toolIcons: Record<AnnotationTool, LucideIcon> = {
  arrow: ArrowUpRight,
  box: Square,
  circle: Circle,
  freehand: PenLine,
  text: Type,
};

export type ImageAnnotatorProps = {
  /** The image to draw on, or null when the screen is closed. */
  mediaId: string | null;
  onClose: () => void;
  /**
   * Called with the new annotated copy after it is saved. The parent closes the screen (sets
   * `mediaId` to null); `onClose` is only for leaving without saving.
   */
  onSaved: (media: Media) => void;
};

/**
 * Full-screen drawing over an image (PRODUCT_SPEC §4.1): arrow, box, circle, pen and text tools
 * in 5 colours, with undo/redo. Saving makes a new image derived from the original, which is
 * kept. Opening an annotated copy again brings its strokes back so they can be changed.
 */
export function ImageAnnotator({ mediaId, onClose, onSaved }: ImageAnnotatorProps) {
  if (!mediaId) return null;
  return <AnnotatorSession key={mediaId} mediaId={mediaId} onClose={onClose} onSaved={onSaved} />;
}

function AnnotatorSession({
  mediaId,
  onClose,
  onSaved,
}: Omit<ImageAnnotatorProps, 'mediaId'> & { mediaId: string }) {
  const state = useAnnotationStart(mediaId);
  const [changed, setChanged] = useState(false);

  // The close button and Android's back button both ask first when there are unsaved changes.
  const confirmClose = () => {
    if (!changed) return onClose();
    Alert.alert(s.discardTitle, s.discardMessage, [
      { text: s.keepDrawing, style: 'cancel' },
      { text: s.discard, style: 'destructive', onPress: onClose },
    ]);
  };

  return (
    <Modal visible onRequestClose={confirmClose} animationType="slide" statusBarTranslucent>
      {/* A Modal is a separate native window, so gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {state.status === 'ready' ? (
          <Annotator
            start={state.start}
            onClose={confirmClose}
            onSaved={onSaved}
            onChangedChange={setChanged}
          />
        ) : (
          <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center px-1">
              <IconButton icon={X} accessibilityLabel={s.close} onPress={onClose} />
              <Text variant="heading">{s.title}</Text>
            </View>
            <View className="flex-1 items-center justify-center gap-3 p-6">
              {state.status === 'loading' ? <ActivityIndicator /> : null}
              <Text tone="muted" className="text-center">
                {state.status === 'loading' ? s.loading : s.missing}
              </Text>
            </View>
          </SafeAreaView>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Annotator({
  start,
  onClose,
  onSaved,
  onChangedChange,
}: {
  start: AnnotationStart;
  onClose: () => void;
  onSaved: (media: Media) => void;
  onChangedChange: (changed: boolean) => void;
}) {
  const { colors } = useTheme();
  const save = useSaveAnnotation();
  const { base, annotation } = start;
  const size = useMemo(
    () => ({ width: annotation.width, height: annotation.height }),
    [annotation.width, annotation.height],
  );
  const uri = base.localUri ? deviceMediaStore.resolve(base.localUri) : null;
  const image = useImage(uri);
  const font = useMemo(() => labelFont(size), [size]);

  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [colour, setColour] = useState<AnnotationColourName>('red');
  const [drawing, dispatch] = useReducer(drawingReducer, annotation.shapes, startDrawing);
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [text, setText] = useState('');
  const [view, setView] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const { history } = drawing;
  const changed = hasChanges(history, annotation.shapes);
  useEffect(() => onChangedChange(changed), [changed, onChangedChange]);

  const fit = fitImage(size, view);
  const minStep = strokeWidthFor(size) / 2;
  const minDrag = minDragFor(size);
  const imagePoint = (x: number, y: number) => toImagePoint({ x, y }, fit, size);

  const pan = Gesture.Pan()
    .withTestId('annotation-pan')
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .onStart((event) => {
      if (tool !== 'text') {
        dispatch({ type: 'start', tool, colour, at: imagePoint(event.x, event.y) });
      }
    })
    .onUpdate((event) => dispatch({ type: 'move', to: imagePoint(event.x, event.y), minStep }))
    .onEnd(() => dispatch({ type: 'end', minDrag }))
    .onFinalize(() => dispatch({ type: 'cancel' }));

  const tap = Gesture.Tap()
    .withTestId('annotation-tap')
    .runOnJS(true)
    .onEnd((event) => {
      setText('');
      setTextAt(imagePoint(event.x, event.y));
    });

  const addText = () => {
    if (textAt) dispatch({ type: 'addText', colour, at: textAt, text });
    setTextAt(null);
    setText('');
  };

  const onSave = async () => {
    setSaving(true);
    setFailed(false);
    try {
      const media = await save(base, { ...annotation, shapes: history.present });
      onSaved(media);
    } catch (error) {
      log.error('Saving a drawing failed', error);
      setFailed(true);
      setSaving(false);
    }
  };

  const shapes = visibleShapes(drawing);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center gap-1 px-1">
          <IconButton icon={X} accessibilityLabel={s.close} onPress={onClose} />
          <Text variant="heading" className="flex-1" numberOfLines={1}>
            {s.title}
          </Text>
          <IconButton
            icon={Undo2}
            accessibilityLabel={s.undo}
            disabled={!canUndo(history)}
            onPress={() => dispatch({ type: 'undo' })}
          />
          <IconButton
            icon={Redo2}
            accessibilityLabel={s.redo}
            disabled={!canRedo(history)}
            onPress={() => dispatch({ type: 'redo' })}
          />
          <Button
            label={saving ? s.saving : s.save}
            loading={saving}
            disabled={!changed || !image}
            onPress={() => void onSave()}
            className="mr-2"
          />
        </View>

        <GestureDetector gesture={tool === 'text' ? tap : pan}>
          <View
            className="flex-1 bg-surface-muted"
            onLayout={(event: LayoutChangeEvent) => {
              const { width, height } = event.nativeEvent.layout;
              setView({ width, height });
            }}
            accessible
            accessibilityLabel={s.canvasLabel}
            accessibilityHint={tool === 'text' ? s.textCanvasHint : s.canvasHint}
            testID="annotation-canvas"
          >
            {image && view.width > 0 ? (
              <Canvas style={{ flex: 1 }}>
                <Group
                  transform={[
                    { translateX: fit.offsetX },
                    { translateY: fit.offsetY },
                    { scale: fit.scale },
                  ]}
                >
                  <AnnotationScene image={image} size={size} shapes={shapes} font={font} />
                </Group>
              </Canvas>
            ) : (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>
        </GestureDetector>

        {textAt ? (
          <View className="gap-3 border-t border-border bg-surface p-4">
            <Input
              label={s.textLabel}
              placeholder={s.textPlaceholder}
              value={text}
              onChangeText={setText}
              maxLength={60}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addText}
            />
            <View className="flex-row justify-end gap-2">
              <Button label={s.cancel} variant="ghost" onPress={() => setTextAt(null)} />
              <Button label={s.addText} disabled={!text.trim()} onPress={addText} />
            </View>
          </View>
        ) : (
          <View className="gap-2 border-t border-border bg-surface px-2 pb-2 pt-1">
            <View
              accessibilityRole="toolbar"
              accessibilityLabel={s.toolsLabel}
              className="flex-row"
            >
              {annotationTools.map((name) => (
                <ToolButton
                  key={name}
                  icon={toolIcons[name]}
                  label={s.tools[name]}
                  selected={tool === name}
                  onPress={() => setTool(name)}
                />
              ))}
            </View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={s.coloursLabel}
              className="flex-row justify-center gap-3"
            >
              {annotationColourNames.map((name) => (
                <Swatch
                  key={name}
                  colour={name}
                  selected={colour === name}
                  onPress={() => setColour(name)}
                />
              ))}
            </View>
            {failed ? (
              <Text tone="danger" variant="small" className="text-center">
                {s.failed}
              </Text>
            ) : (
              <Text tone="muted" variant="caption" className="text-center">
                {s.originalKept}
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToolButton({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'min-h-touch flex-1 items-center justify-center gap-0.5 rounded-md py-1 active:opacity-70',
        selected && 'bg-primary-soft',
      )}
    >
      <Icon color={selected ? colors['on-primary-soft'] : colors.fg} size={22} />
      <Text variant="caption" tone={selected ? 'default' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A colour choice. The chosen one also gets a tick and a ring, never colour alone. */
function Swatch({
  colour,
  selected,
  onPress,
}: {
  colour: AnnotationColourName;
  selected: boolean;
  onPress: () => void;
}) {
  const { pen, halo } = annotationColours[colour];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={s.colours[colour]}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full border-2',
        selected ? 'border-fg' : 'border-transparent',
      )}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-full border border-border"
        style={{ backgroundColor: pen }}
      >
        {selected ? <Check color={halo} size={18} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

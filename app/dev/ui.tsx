import { Redirect, router } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  NotebookPen,
  Play,
  Plus,
  Search,
  Settings,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Input,
  PressableCard,
  ProgressBar,
  ProgressRing,
  Skeleton,
  Text,
  TextArea,
  useToast,
} from '@/components/ui';
import { strings } from '@/i18n/strings';
import { colorNames, useTheme, type ThemePreference } from '@/theme';

const s = strings.devGallery;

// Developer-only gallery of every UI primitive (task 0.4). Release builds redirect home.
export default function UiGalleryScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="subheading" tone="primary">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Gallery() {
  const { preference, setPreference, colors } = useTheme();
  const toast = useToast();
  const [chip, setChip] = useState<string>(s.chips[0]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [cardTaps, setCardTaps] = useState(0);

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: s.themeSystem },
    { value: 'light', label: s.themeLight },
    { value: 'dark', label: s.themeDark },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-row items-center gap-2 border-b border-border px-2 py-1">
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={strings.common.close}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Text variant="heading">{s.title}</Text>
      </View>
      <ScrollView contentContainerClassName="gap-8 p-5 pb-24">
        <Section title={s.theme}>
          <View className="flex-row flex-wrap gap-2">
            {themeOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={preference === option.value}
                onPress={() => setPreference(option.value)}
              />
            ))}
          </View>
        </Section>

        <Section title={s.sections.text}>
          <Text variant="display">{s.sampleText.display}</Text>
          <Text variant="title">{s.sampleText.title}</Text>
          <Text variant="heading">{s.sampleText.heading}</Text>
          <Text variant="subheading">{s.sampleText.subheading}</Text>
          <Text>{s.sampleText.body}</Text>
          <Text variant="bodyStrong">{s.sampleText.bodyStrong}</Text>
          <Text variant="small">{s.sampleText.small}</Text>
          <Text variant="caption">{s.sampleText.caption}</Text>
          <Text tone="muted">{s.sampleText.muted}</Text>
        </Section>

        <Section title={s.sections.buttons}>
          <Button label={s.buttons.primary} />
          <Button label={s.buttons.secondary} variant="secondary" />
          <Button label={s.buttons.outline} variant="outline" />
          <Button label={s.buttons.ghost} variant="ghost" />
          <Button label={s.buttons.danger} variant="danger" />
          <Button label={s.buttons.withIcon} icon={Play} />
          <Button label={s.buttons.loading} loading />
          <Button label={s.buttons.disabled} disabled />
          <Button label={s.buttons.large} size="lg" />
        </Section>

        <Section title={s.sections.iconButtons}>
          <View className="flex-row gap-3">
            <IconButton icon={Search} accessibilityLabel={s.iconLabels.search} />
            <IconButton icon={Settings} variant="soft" accessibilityLabel={s.iconLabels.settings} />
            <IconButton icon={Plus} variant="primary" accessibilityLabel={s.iconLabels.add} />
          </View>
        </Section>

        <Section title={s.sections.cards}>
          <Card className="gap-1">
            <Text variant="subheading">{s.card.title}</Text>
            <Text tone="muted">{s.card.body}</Text>
          </Card>
          <PressableCard onPress={() => setCardTaps((n) => n + 1)}>
            <Text>{cardTaps > 0 ? `${s.card.pressed} ×${cardTaps}` : s.card.pressable}</Text>
          </PressableCard>
        </Section>

        <Section title={s.sections.inputs}>
          <Input
            label={s.inputs.label}
            placeholder={s.inputs.placeholder}
            hint={s.inputs.hint}
            value={deckName}
            onChangeText={setDeckName}
          />
          <Input
            label={s.inputs.errorLabel}
            defaultValue={s.inputs.errorValue}
            error={s.inputs.error}
          />
          <TextArea label={s.inputs.areaLabel} placeholder={s.inputs.areaPlaceholder} />
        </Section>

        <Section title={s.sections.chips}>
          <View className="flex-row flex-wrap gap-2">
            {s.chips.map((label) => (
              <Chip
                key={label}
                label={label}
                selected={chip === label}
                onPress={() => setChip(label)}
              />
            ))}
            <Chip label={s.chipWithIcon} icon={BookOpen} />
          </View>
        </Section>

        <Section title={s.sections.progress}>
          <ProgressBar value={0.35} accessibilityLabel={s.progress.bar} />
          <ProgressBar value={0.7} tone="accent" accessibilityLabel={s.progress.bar} />
          <ProgressBar value={1} tone="success" accessibilityLabel={s.progress.bar} />
          <View className="flex-row items-center gap-6">
            <ProgressRing value={0.65} accessibilityLabel={s.progress.ring}>
              <Text variant="label">{s.progress.ringValue}</Text>
            </ProgressRing>
            <ProgressRing value={0.3} tone="accent" size={56} strokeWidth={6} />
            <ProgressRing value={0} tone="success" size={56} strokeWidth={6} />
          </View>
        </Section>

        <Section title={s.sections.sheetToast}>
          <Button label={s.sheet.open} variant="outline" onPress={() => setSheetOpen(true)} />
          <Button
            label={s.toast.info}
            variant="outline"
            onPress={() => toast.show({ message: s.toast.infoMessage })}
          />
          <Button
            label={s.toast.success}
            variant="outline"
            onPress={() => toast.show({ message: s.toast.successMessage, tone: 'success' })}
          />
          <Button
            label={s.toast.error}
            variant="outline"
            onPress={() => toast.show({ message: s.toast.errorMessage, tone: 'error' })}
          />
          <Button
            label={s.toast.undo}
            variant="outline"
            onPress={() =>
              toast.show({
                message: s.toast.undoMessage,
                actionLabel: s.toast.undoAction,
                onAction: () => toast.show({ message: s.toast.undone, tone: 'success' }),
              })
            }
          />
        </Section>

        <Section title={s.sections.emptyState}>
          <Card>
            <EmptyState
              icon={NotebookPen}
              title={s.empty.title}
              message={s.empty.message}
              actionLabel={s.empty.action}
              onAction={() => toast.show({ message: s.empty.action })}
            />
          </Card>
        </Section>

        <Section title={s.sections.skeleton}>
          <View className="flex-row items-center gap-3">
            <Skeleton width={48} height={48} radius={24} />
            <View className="flex-1 gap-2">
              <Skeleton height={16} width="70%" />
              <Skeleton height={12} width="45%" />
            </View>
          </View>
          <Skeleton height={96} radius={16} />
        </Section>

        <Section title={s.sections.colours}>
          <View className="flex-row flex-wrap gap-2">
            {colorNames.map((name) => (
              <View key={name} className="w-[30%] gap-1">
                <View
                  className="h-10 rounded-sm border border-border"
                  style={{ backgroundColor: colors[name] }}
                />
                <Text variant="caption" tone="muted">
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={s.sheet.title}>
        <View className="gap-3">
          <Text tone="muted">{s.sheet.body}</Text>
          <Button label={s.buttons.primary} onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

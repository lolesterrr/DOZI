import { format, parseISO } from 'date-fns';
import {
  Brain,
  Calculator,
  Eye,
  Flame,
  GraduationCap,
  Layers,
  Lock,
  Medal,
  NotebookPen,
  Pill,
  ScanEye,
  Shield,
  ShieldCheck,
  Star,
  Sunrise,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import { cn, ProgressBar, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import type { AchievementKey } from '../achievements';
import type { AchievementEntry } from '../achievementsRepo';
import { useAchievements } from '../hooks';

const s = strings.achievements;

const icons: Record<AchievementKey, LucideIcon> = {
  first_dose: Pill,
  card_collector: Layers,
  note_taker: NotebookPen,
  diagram_master: ScanEye,
  week_warrior: Flame,
  unbreakable: Shield,
  century: Trophy,
  perfect_checkpoint: Star,
  topic_mastered: GraduationCap,
  ans_ace: Brain,
  antimicrobial_guardian: ShieldCheck,
  pk_pro: Calculator,
  mock_survivor: Medal,
  sharp_eye: Eye,
  early_bird: Sunrise,
};

/** The badge gallery (Me tab): earned badges first; locked ones show their hint and progress. */
export function AchievementGallery() {
  const { loading, entries } = useAchievements();
  if (loading) return null;
  const earned = entries.filter((e) => e.unlockedAt).length;
  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text variant="heading" accessibilityRole="header">
          {s.title}
        </Text>
        <Text variant="small" tone="muted">
          {s.count(earned, entries.length)}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {entries.map((entry) => (
          <Badge key={entry.key} entry={entry} />
        ))}
      </View>
    </View>
  );
}

function Badge({ entry }: { entry: AchievementEntry }) {
  const { colors } = useTheme();
  const item = s.items[entry.key];
  const Icon = icons[entry.key];
  const earned = !!entry.unlockedAt;
  const detail = earned
    ? s.unlockedOn(format(parseISO(entry.unlockedAt as string), 'd MMM yyyy'))
    : item.hint;
  const state = earned ? s.earned : s.locked;
  return (
    <View
      accessible
      accessibilityLabel={`${s.itemLabel(item.name, state)}. ${detail}${
        !earned && entry.measurable ? `. ${s.progress(entry.value, entry.target)}` : ''
      }`}
      testID={`badge-${entry.key}`}
      className={cn(
        'min-h-touch w-[48%] grow gap-2 rounded-lg border p-3',
        earned ? 'border-accent bg-accent-soft' : 'border-border bg-surface',
      )}
    >
      <View className="flex-row items-center justify-between">
        <View
          className={cn(
            'h-11 w-11 items-center justify-center rounded-full',
            earned ? 'bg-surface' : 'bg-surface-muted',
          )}
        >
          <Icon color={earned ? colors.accent : colors['fg-muted']} size={24} />
        </View>
        {earned ? null : <Lock color={colors['fg-muted']} size={16} />}
      </View>
      <Text
        variant="bodyStrong"
        tone={earned ? 'inherit' : 'default'}
        className={earned ? 'text-on-accent-soft' : ''}
      >
        {item.name}
      </Text>
      <Text
        variant="small"
        tone={earned ? 'inherit' : 'muted'}
        className={earned ? 'text-on-accent-soft' : ''}
      >
        {detail}
      </Text>
      {!earned && entry.measurable ? (
        <View className="gap-1">
          <ProgressBar value={entry.fraction} accessibilityLabel={item.name} />
          <Text variant="caption" tone="muted">
            {s.progress(entry.value, entry.target)}
          </Text>
        </View>
      ) : null}
      {!earned && !entry.measurable ? (
        <Text variant="caption" tone="muted">
          {s.comingLater}
        </Text>
      ) : null}
    </View>
  );
}

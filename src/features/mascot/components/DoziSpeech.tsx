import { View } from 'react-native';

import { Text } from '@/components/ui';

import type { DoziMood } from '../moods';
import { Dozi } from './Dozi';

export type DoziSpeechProps = {
  mood?: DoziMood;
  message: string;
  /** Dozi's size in dp. */
  size?: number;
};

/** Dozi with a speech bubble beside them. The bubble grows with the text. */
export function DoziSpeech({ mood = 'idle', message, size = 72 }: DoziSpeechProps) {
  return (
    <View className="flex-row items-center gap-3">
      <Dozi mood={mood} size={size} />
      <View className="flex-1">
        <View className="rounded-2xl border border-border bg-surface px-4 py-3">
          <Text>{message}</Text>
        </View>
        {/* The bubble's tail: a small square turned on its corner, pointing at Dozi. */}
        <View
          pointerEvents="none"
          className="absolute -left-1.5 top-1/2 -mt-1.5 h-3 w-3 rotate-45 border-b border-l border-border bg-surface"
        />
      </View>
    </View>
  );
}

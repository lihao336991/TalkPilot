import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Keyframe,
} from 'react-native-reanimated';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import SuggestionCard from './SuggestionCard';
import { spacing } from '@/shared/theme/tokens';

type Props = {
  onSendSuggestion: (text: string) => void | Promise<void>;
  isSendingSuggestion?: boolean;
};

export default function SuggestionPanel({
  onSendSuggestion,
  isSendingSuggestion = false,
}: Props) {
  const { suggestions, triggerTurnId } = useSuggestionStore();
  const suggestion = suggestions[0];

  if (!suggestion) {
    return null;
  }

  return (
    <Animated.View
      key={triggerTurnId ?? suggestion.text}
      entering={bubbleEnter}
      exiting={bubbleExit}
      style={styles.container}
    >
      <Animated.View
        pointerEvents="none"
        entering={glowEnter}
        exiting={glowExit}
        style={styles.glow}
      />
      <SuggestionCard
        suggestion={suggestion}
        onSend={() => onSendSuggestion(suggestion.text)}
        isSending={isSendingSuggestion}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  glow: {
    position: 'absolute',
    left: spacing.lg + 10,
    right: spacing.lg + 10,
    top: 18,
    bottom: spacing.sm,
    borderRadius: 32,
    backgroundColor: 'rgba(178,220,44,0.34)',
  },
});

const bubbleEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 38 },
      { scale: 0.72 },
    ],
  },
  55: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scale: 1.04 },
    ],
  },
  100: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scale: 1 },
    ],
  },
}).duration(420);

const bubbleExit = new Keyframe({
  0: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scale: 1 },
    ],
  },
  100: {
    opacity: 0,
    transform: [
      { translateY: 30 },
      { scale: 0.74 },
    ],
  },
}).duration(260);

const glowEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ scale: 0.86 }],
  },
  60: {
    opacity: 0.68,
    transform: [{ scale: 1.08 }],
  },
  100: {
    opacity: 0.34,
    transform: [{ scale: 1 }],
  },
}).duration(460);

const glowExit = new Keyframe({
  0: {
    opacity: 0.34,
    transform: [{ scale: 1 }],
  },
  100: {
    opacity: 0,
    transform: [{ scale: 0.84 }],
  },
}).duration(220);

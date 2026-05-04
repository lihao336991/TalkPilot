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
    <View key={triggerTurnId ?? suggestion.text} style={styles.container}>
      <Animated.View
        pointerEvents="none"
        entering={auraEnter}
        exiting={auraExit}
        style={styles.glow}
      />
      <Animated.View
        entering={dropletShellEnter}
        exiting={dropletShellExit}
        style={styles.cardShell}
      >
        <Animated.View
          entering={dropletContentEnter}
          exiting={dropletContentExit}
        >
          <SuggestionCard
            suggestion={suggestion}
            onSend={() => onSendSuggestion(suggestion.text)}
            isSending={isSendingSuggestion}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  cardShell: {
    borderRadius: 32,
  },
  glow: {
    position: 'absolute',
    left: spacing.lg + 12,
    right: spacing.lg + 12,
    top: 20,
    bottom: spacing.md,
    borderRadius: 32,
    backgroundColor: 'rgba(178,220,44,0.34)',
  },
});

const dropletShellEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 58 },
      { scaleX: 0.18 },
      { scaleY: 0.12 },
    ],
  },
  14: {
    opacity: 0.86,
    transform: [
      { translateY: 34 },
      { scaleX: 0.38 },
      { scaleY: 0.96 },
    ],
  },
  42: {
    opacity: 1,
    transform: [
      { translateY: -8 },
      { scaleX: 1.14 },
      { scaleY: 0.84 },
    ],
  },
  64: {
    opacity: 1,
    transform: [
      { translateY: 2 },
      { scaleX: 0.94 },
      { scaleY: 1.08 },
    ],
  },
  82: {
    opacity: 1,
    transform: [
      { translateY: -1 },
      { scaleX: 1.03 },
      { scaleY: 0.98 },
    ],
  },
  100: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scaleX: 1 },
      { scaleY: 1 },
    ],
  },
}).duration(620);

const dropletShellExit = new Keyframe({
  0: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scaleX: 1 },
      { scaleY: 1 },
    ],
  },
  28: {
    opacity: 0.96,
    transform: [
      { translateY: -6 },
      { scaleX: 1.08 },
      { scaleY: 0.9 },
    ],
  },
  52: {
    opacity: 0.92,
    transform: [
      { translateY: 3 },
      { scaleX: 0.94 },
      { scaleY: 1.04 },
    ],
  },
  100: {
    opacity: 0,
    transform: [
      { translateY: 34 },
      { scaleX: 0.14 },
      { scaleY: 0.2 },
    ],
  },
}).duration(380);

const dropletContentEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 18 },
      { scale: 0.92 },
    ],
  },
  58: {
    opacity: 1,
    transform: [
      { translateY: -4 },
      { scale: 1.03 },
    ],
  },
  100: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scale: 1 },
    ],
  },
}).duration(340).delay(120);

const dropletContentExit = new Keyframe({
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
      { translateY: 12 },
      { scale: 0.92 },
    ],
  },
}).duration(150);

const auraEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 54 },
      { scaleX: 0.2 },
      { scaleY: 0.16 },
    ],
  },
  36: {
    opacity: 0.78,
    transform: [
      { translateY: 8 },
      { scaleX: 1.22 },
      { scaleY: 0.82 },
    ],
  },
  72: {
    opacity: 0.4,
    transform: [
      { translateY: 1 },
      { scaleX: 0.96 },
      { scaleY: 1.04 },
    ],
  },
  100: {
    opacity: 0.34,
    transform: [
      { translateY: 0 },
      { scaleX: 1 },
      { scaleY: 1 },
    ],
  },
}).duration(660);

const auraExit = new Keyframe({
  0: {
    opacity: 0.34,
    transform: [
      { translateY: 0 },
      { scaleX: 1 },
      { scaleY: 1 },
    ],
  },
  100: {
    opacity: 0,
    transform: [
      { translateY: 22 },
      { scaleX: 0.28 },
      { scaleY: 0.2 },
    ],
  },
}).duration(300);

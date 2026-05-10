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

  return (
    <View style={styles.container}>
      {suggestion && (
        <View key={triggerTurnId ?? suggestion.text}>
          <Animated.View
            pointerEvents="none"
            entering={auraEnter}
            exiting={auraExit}
            style={styles.glow}
          />
          <Animated.View
            entering={panelShellEnter}
            exiting={panelShellExit}
            style={styles.cardShell}
          >
            <Animated.View
              entering={panelContentEnter}
              exiting={panelContentExit}
            >
              <SuggestionCard
                suggestion={suggestion}
                onSend={() => onSendSuggestion(suggestion.text)}
                isSending={isSendingSuggestion}
              />
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 114,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  cardShell: {
    borderRadius: 28,
  },
  glow: {
    position: 'absolute',
    left: spacing.lg + 14,
    right: spacing.lg + 14,
    top: 22,
    bottom: spacing.md,
    borderRadius: 30,
    backgroundColor: 'rgba(117,153,0,0.38)',
  },
});

const panelShellEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 24 },
      { scale: 0.97 },
    ],
  },
  48: {
    opacity: 0.82,
    transform: [
      { translateY: 7 },
      { scale: 0.992 },
    ],
  },
  78: {
    opacity: 1,
    transform: [
      { translateY: -2 },
      { scale: 1.004 },
    ],
  },
  100: {
    opacity: 1,
    transform: [
      { translateY: 0 },
      { scale: 1 },
    ],
  },
}).duration(430);

const panelShellExit = new Keyframe({
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
      { translateY: 16 },
      { scale: 0.98 },
    ],
  },
}).duration(220);

const panelContentEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 10 },
    ],
  },
  66: {
    opacity: 0.72,
    transform: [
      { translateY: 3 },
    ],
  },
  100: {
    opacity: 1,
    transform: [
      { translateY: 0 },
    ],
  },
}).duration(300).delay(80);

const panelContentExit = new Keyframe({
  0: {
    opacity: 1,
    transform: [
      { translateY: 0 },
    ],
  },
  100: {
    opacity: 0,
    transform: [
      { translateY: 8 },
    ],
  },
}).duration(150);

const auraEnter = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { translateY: 18 },
      { scale: 0.9 },
    ],
  },
  58: {
    opacity: 0.72,
    transform: [
      { translateY: 4 },
      { scale: 1.04 },
    ],
  },
  100: {
    opacity: 0.5,
    transform: [
      { translateY: 0 },
      { scale: 1 },
    ],
  },
}).duration(430);

const auraExit = new Keyframe({
  0: {
    opacity: 0.5,
    transform: [
      { translateY: 0 },
      { scale: 1 },
    ],
  },
  100: {
    opacity: 0,
    transform: [
      { translateY: 10 },
      { scale: 0.94 },
    ],
  },
}).duration(220);

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type ConversationToolbarProps = {
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  isPaused: boolean;
  duration: number;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ConversationToolbar({ onPause, onResume, onEnd, isPaused, duration }: ConversationToolbarProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={isPaused ? onResume : onPause}
        accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
      >
        <Feather
          name={isPaused ? 'play-circle' : 'pause-circle'}
          size={28}
          color="#1A1A1A"
        />
      </Pressable>

      <Text style={styles.timer}>{formatDuration(duration)}</Text>

      <Pressable
        style={styles.button}
        onPress={onEnd}
        accessibilityLabel="End conversation"
      >
        <Feather name="stop-circle" size={28} color="#FF3B30" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  button: {
    padding: 8,
  },
  timer: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#1A1A1A',
  },
});

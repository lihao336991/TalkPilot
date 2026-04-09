import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  score: 'green' | 'yellow' | 'red';
  onPress: () => void;
};

const SCORE_COLORS: Record<string, string> = {
  green: '#34C759',
  yellow: '#FF9500',
  red: '#FF3B30',
};

export default function ReviewIndicator({ score, onPress }: Props) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <View style={[styles.bar, { backgroundColor: SCORE_COLORS[score] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 3,
    borderRadius: 1.5,
    marginTop: 4,
  },
});

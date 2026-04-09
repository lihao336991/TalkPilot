import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type SuggestionStyle = 'formal' | 'casual' | 'simple';

type Props = {
  suggestion: {
    style: SuggestionStyle;
    text: string;
  };
  onPress?: () => void;
};

const BADGE_COLORS: Record<SuggestionStyle, string> = {
  formal: '#E8E3F3',
  casual: '#E3F0E8',
  simple: '#F0EDE3',
};

export default function SuggestionCard({ suggestion, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.badge, { backgroundColor: BADGE_COLORS[suggestion.style] }]}>
        <Text style={styles.badgeText}>{suggestion.style.toUpperCase()}</Text>
      </View>
      <Text style={styles.text}>{suggestion.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1A1A1A',
  },
});

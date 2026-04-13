import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import SuggestionCard from './SuggestionCard';

export default function SuggestionPanel() {
  const { suggestions, clear } = useSuggestionStore();
  const visible = suggestions.length > 0;

  if (!visible) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTag}>
          <Text style={styles.headerTagText}>Quick Reply</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={clear} hitSlop={8}>
          <Feather name="x" size={14} color="#1A1A1A" />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((item, index) => (
          <SuggestionCard key={`${item.style}-${index}`} suggestion={item} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(21,22,25,0.05)',
  },
  headerTagText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(21,22,25,0.48)',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(21,22,25,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
});

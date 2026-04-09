import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import SuggestionCard from './SuggestionCard';

function LoadingPlaceholder() {
  return (
    <View style={styles.loadingRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.loadingCard}>
          <View style={styles.shimmerBadge} />
          <View style={styles.shimmerLine} />
          <View style={styles.shimmerLineShort} />
        </View>
      ))}
    </View>
  );
}

export default function SuggestionPanel() {
  const { suggestions, isLoading, clear } = useSuggestionStore();
  const visible = isLoading || suggestions.length > 0;

  if (!visible) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      <Pressable style={styles.closeButton} onPress={clear} hitSlop={8}>
        <Feather name="x" size={14} color="#1A1A1A" />
      </Pressable>
      {isLoading ? (
        <LoadingPlaceholder />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {suggestions.map((item, index) => (
            <SuggestionCard key={`${item.style}-${index}`} suggestion={item} />
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(21,22,25,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  loadingCard: {
    width: 240,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    gap: 10,
  },
  shimmerBadge: {
    width: 60,
    height: 22,
    borderRadius: 8,
    backgroundColor: '#F5F2ED',
  },
  shimmerLine: {
    width: '100%',
    height: 14,
    borderRadius: 6,
    backgroundColor: '#F5F2ED',
  },
  shimmerLineShort: {
    width: '60%',
    height: 14,
    borderRadius: 6,
    backgroundColor: '#F5F2ED',
  },
});

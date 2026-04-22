import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import SuggestionCard from './SuggestionCard';
import { palette, radii, spacing, typography } from '@/shared/theme/tokens';

export default function SuggestionPanel() {
  const { t } = useTranslation();
  const { suggestions, clear } = useSuggestionStore();
  const visible = suggestions.length > 0;

  if (!visible) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTag}>
          <Text style={styles.headerTagText}>{t('live.suggestionPanel.title')}</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={clear} hitSlop={8}>
          <Feather name="x" size={14} color={palette.textPrimary} />
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
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  headerTag: {
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: palette.accentMutedMid,
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
  },
  headerTagText: {
    ...typography.labelSm,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: palette.textAccent,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ReviewResult } from '@/features/live/store/reviewStore';

type Props = {
  review: ReviewResult;
  onPress: () => void;
};

const SCORE_META = {
  yellow: {
    label: 'Warn',
    color: '#FF9500',
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  red: {
    label: 'Error',
    color: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.12)',
  },
} as const;

function getSummary(review: ReviewResult) {
  if (review.issues.length > 0) {
    const primaryIssue = review.issues[0];
    const recommendation = review.betterExpression ?? primaryIssue?.corrected ?? null;
    const issueLabel =
      primaryIssue?.type === 'grammar'
        ? 'Grammar'
        : primaryIssue?.type === 'vocabulary'
          ? 'Wording'
          : 'Naturalness';
    return {
      title: issueLabel,
      subtitle: recommendation ? `Try: ${recommendation}` : 'Tap to review details',
    };
  }

  if (review.betterExpression) {
    return {
      title: 'More natural option',
      subtitle: review.betterExpression,
    };
  }

  return {
    title: 'Suggestion',
    subtitle: 'Tap to see feedback',
  };
}

export default function ReviewIndicator({ review, onPress }: Props) {
  const meta = SCORE_META[review.overallScore];
  const summary = getSummary(review);

  return (
    <Pressable
      style={[styles.container, { backgroundColor: meta.backgroundColor }]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.scoreLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.title}>{summary.title}</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {summary.subtitle}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={15} color="rgba(21,22,25,0.34)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    maxWidth: '88%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#151619',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(21,22,25,0.72)',
  },
});

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ReviewResult } from '@/features/live/store/reviewStore';
import { palette, radii, spacing, typography } from '@/shared/theme/tokens';

type Props = {
  review: ReviewResult;
  onPress: () => void;
};

const SCORE_META = {
  green: {
    color: palette.accentDark,
    backgroundColor: palette.accentMuted,
  },
  yellow: {
    color: '#B45309',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  red: {
    color: palette.danger,
    backgroundColor: palette.dangerLight,
  },
} as const;

function getSummary(
  review: ReviewResult,
  t: (key: string, params?: Record<string, string>) => string,
) {
  if (review.issues.length > 0) {
    const primaryIssue = review.issues[0];
    const recommendation = review.betterExpression ?? primaryIssue?.corrected ?? null;
    const issueLabel =
      primaryIssue?.type === 'grammar'
        ? t('live.reviewIndicator.grammar')
        : primaryIssue?.type === 'vocabulary'
          ? t('live.reviewIndicator.wording')
          : t('live.reviewIndicator.naturalness');
    return {
      title: issueLabel,
      subtitle: recommendation
        ? t('live.reviewIndicator.tryTemplate', { text: recommendation })
        : t('live.reviewIndicator.tapReviewDetails'),
    };
  }

  if (review.betterExpression) {
    return {
      title: t('live.reviewIndicator.moreNaturalOption'),
      subtitle: review.betterExpression,
    };
  }

  return {
    title: t('live.reviewIndicator.suggestion'),
    subtitle: t('live.reviewIndicator.tapSeeFeedback'),
  };
}

export default function ReviewIndicator({ review, onPress }: Props) {
  const { t } = useTranslation();
  const meta = SCORE_META[review.overallScore];
  const scoreLabel =
    review.overallScore === 'green'
      ? t('live.reviewIndicator.pass')
      : review.overallScore === 'yellow'
        ? t('live.reviewIndicator.warn')
        : t('live.reviewIndicator.error');
  const summary = getSummary(review, t);

  return (
    <Pressable
      style={[styles.container, { backgroundColor: meta.backgroundColor }]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.scoreLabel, { color: meta.color }]}>{scoreLabel}</Text>
            <Text style={styles.title}>{summary.title}</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {summary.subtitle}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={15} color={palette.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm - 2,
    maxWidth: '88%',
    borderRadius: radii.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm + 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.xs / 2,
    marginTop: 5,
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
  },
  scoreLabel: {
    ...typography.labelSm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.labelMd,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    ...typography.labelMd,
    lineHeight: 16,
    color: palette.textSecondary,
  },
});

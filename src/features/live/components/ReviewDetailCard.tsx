import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { palette, radii, shadows, spacing, typography } from '@/shared/theme/tokens';

type ReviewIssue = {
  type: string;
  original: string;
  corrected: string;
  explanation: string;
};

type Review = {
  overallScore: 'green' | 'yellow' | 'red';
  issues: ReviewIssue[];
  betterExpression: string | null;
  praise: string | null;
};

type Props = {
  review: Review;
  onClose: () => void;
};

const SCORE_COLORS: Record<string, string> = {
  green: palette.accentDark,
  yellow: '#B45309',
  red: palette.danger,
};

export default function ReviewDetailCard({ review, onClose }: Props) {
  const { t } = useTranslation();
  const scoreLabel =
    review.overallScore === 'green'
      ? t('live.reviewIndicator.pass')
      : review.overallScore === 'yellow'
        ? t('live.reviewIndicator.warn')
        : t('live.reviewIndicator.error');
  const scoreHelpText =
    review.overallScore === 'green'
      ? t('live.reviewDetail.scoreHelpPass')
      : review.overallScore === 'yellow'
        ? t('live.reviewDetail.scoreHelpWarn')
        : t('live.reviewDetail.scoreHelpError');

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.scoreDot, { backgroundColor: SCORE_COLORS[review.overallScore] }]} />
            <View>
              <Text style={styles.headerTitle}>{scoreLabel}</Text>
              <Text style={styles.headerSubtitle}>{scoreHelpText}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color={palette.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {review.issues.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('live.reviewDetail.mainIssue')}</Text>
              {review.issues.slice(0, 2).map((issue, index) => (
                <View key={index} style={styles.issueItem}>
                  <View style={styles.issueTypeBadge}>
                    <Text style={styles.issueTypeText}>{issue.type}</Text>
                  </View>
                  <Text style={styles.microLabel}>{t('live.reviewDetail.youSaid')}</Text>
                  <View style={styles.sourceBox}>
                    <Text style={styles.sourceText}>{issue.original}</Text>
                  </View>
                  <Text style={styles.microLabel}>{t('live.reviewDetail.sayInstead')}</Text>
                  <View style={styles.correctionRow}>
                    <Text style={styles.corrected}>{issue.corrected}</Text>
                  </View>
                  <Text style={styles.explanation} numberOfLines={2}>{issue.explanation}</Text>
                </View>
              ))}
            </View>
          )}

          {review.betterExpression !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('live.reviewDetail.recommendedWording')}
              </Text>
              <View style={styles.expressionBox}>
                <Text style={styles.expressionText}>{review.betterExpression}</Text>
              </View>
            </View>
          )}

          {review.praise !== null && review.issues.length === 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('live.reviewDetail.goodPart')}</Text>
              <Text style={styles.praiseText}>{review.praise}</Text>
            </View>
          )}

          {review.issues.length === 0 && review.betterExpression === null && review.praise === null && (
            <View style={styles.section}>
              <Text style={styles.emptyStateText}>{t('live.reviewDetail.empty')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlayDark,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: palette.bgCardSolid,
    maxHeight: '70%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
    ...shadows.cardLg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.accentBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
  },
  scoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    ...typography.displaySm,
    fontSize: 17,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  headerSubtitle: {
    marginTop: 2,
    ...typography.labelMd,
    lineHeight: 17,
    color: palette.textSecondary,
  },
  body: {
    padding: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodySm,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  issueItem: {
    marginBottom: spacing.lg,
    gap: spacing.sm - 2,
  },
  issueTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs - 2,
    backgroundColor: palette.accentMuted,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  issueTypeText: {
    ...typography.labelSm,
    fontWeight: '600',
    color: palette.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  microLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sourceBox: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: palette.dangerLight,
  },
  sourceText: {
    ...typography.bodySm,
    lineHeight: 20,
    color: palette.danger,
  },
  correctionRow: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: palette.accentMuted,
  },
  corrected: {
    ...typography.bodyMd,
    fontWeight: '700',
    lineHeight: 21,
    color: palette.textAccent,
  },
  explanation: {
    ...typography.bodySm,
    lineHeight: 19,
    color: palette.textSecondary,
  },
  expressionBox: {
    borderRadius: radii.sm + 2,
    padding: spacing.md + 2,
    backgroundColor: palette.bgGhostButton,
  },
  expressionText: {
    ...typography.bodyMd,
    lineHeight: 22,
    color: palette.textPrimary,
  },
  praiseText: {
    ...typography.bodyMd,
    lineHeight: 22,
    color: palette.textPrimary,
  },
  emptyStateText: {
    ...typography.bodySm,
    lineHeight: 20,
    color: palette.textSecondary,
  },
});

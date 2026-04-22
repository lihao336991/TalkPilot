import { Feather } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radii, spacing, typography } from '@/shared/theme/tokens';

type TabScreenHeaderProps = {
  title?: string;
  subtitle?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  actionLabel?: string;
  onActionPress?: () => void;
  actionAccessibilityLabel?: string;
};

export function TabScreenHeader({
  title,
  subtitle,
  actionIcon,
  actionLabel,
  onActionPress,
  actionAccessibilityLabel,
}: TabScreenHeaderProps) {
  const { t } = useTranslation();
  const ActionContainer = onActionPress ? Pressable : View;
  const resolvedTitle = title ?? t('app.defaultHeaderTitle');
  const resolvedSubtitle = subtitle ?? t('app.defaultHeaderSubtitle');

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>{resolvedTitle}</Text>
        <Text style={styles.subtitle}>{resolvedSubtitle}</Text>
      </View>
      {actionIcon || actionLabel ? (
        <ActionContainer
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole={onActionPress ? 'button' : undefined}
          onPress={onActionPress}
          style={[
            styles.actionButton,
            actionLabel ? styles.actionPill : null,
          ]}>
          {actionIcon ? (
            <Feather name={actionIcon} size={20} color={palette.textPrimary} />
          ) : null}
          {actionLabel ? (
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          ) : null}
        </ActionContainer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    backgroundColor: palette.bgBase,
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    ...typography.displayLg,
    letterSpacing: -1,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.eyebrow,
    letterSpacing: 3,
    color: palette.textTertiary,
    marginTop: spacing.xs,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  actionPill: {
    width: 'auto',
    minWidth: 88,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm - 2,
    flexDirection: 'row',
  },
  actionLabel: {
    ...typography.bodySm,
    fontWeight: '700',
    color: palette.textPrimary,
  },
});

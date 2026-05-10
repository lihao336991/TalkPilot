// TODO 二期：Coach 页面 — 实现 prompt 模板、口语训练、复盘 rubric 和表达素材包。
// 当前页面已隐藏，待二期 RecommendationService + CoachModuleCatalog 接入后恢复。
// 参考文档：.trae/documents/Coach与Scene Recommendation方案.md

import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';
import { palette, radii, shadows, spacing, typography } from '@/shared/theme/tokens';

export default function CoachScreen() {
  const { t } = useTranslation();

  return (
    <TabScrollScreen
      title={t('coach.title')}
      subtitle={t('coach.subtitle')}
      actionIcon="message-circle"
    >
      <View style={styles.placeholder}>
        <View style={styles.iconWrap}>
          <Feather name="tool" size={28} color={palette.textTertiary} />
        </View>
        <Text style={styles.placeholderTitle}>{t('coach.placeholderTitle')}</Text>
        <Text style={styles.placeholderBody}>{t('coach.placeholderBody')}</Text>
      </View>
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  placeholderTitle: {
    ...typography.bodyLg,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  placeholderBody: {
    ...typography.bodySm,
    lineHeight: 21,
    color: palette.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});

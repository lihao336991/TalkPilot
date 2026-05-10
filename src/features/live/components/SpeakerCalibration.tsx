import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { palette, radii, shadows, spacing, typography } from '@/shared/theme/tokens';

type SpeakerCalibrationProps = {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
};

function WaveBar({ delay }: { delay: number }) {
  const height = useSharedValue(8);

  useEffect(() => {
    height.value = withRepeat(
      withSequence(
        withTiming(28, { duration: 400 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 400 + delay, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [height, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.waveBar, animatedStyle]} />;
}

export function SpeakerCalibration({ visible, onComplete, onSkip }: SpeakerCalibrationProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="mic" size={24} color={palette.textOnAccent} />
          </View>

          <Text style={styles.title}>{t('live.speakerCalibration.title')}</Text>
          <Text style={styles.instruction}>
            {t('live.speakerCalibration.instruction')}
          </Text>

          <View style={styles.waveContainer}>
            {[0, 80, 160, 240, 120].map((d, i) => (
              <WaveBar key={i} delay={d} />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.skipButton}
              onPress={onSkip}
              accessibilityLabel={t('live.speakerCalibration.skipAccessibilityLabel')}
            >
              <Text style={styles.skipText}>{t('common.actions.skip')}</Text>
            </Pressable>
            <Pressable
              style={styles.doneButton}
              onPress={() => onComplete()}
              accessibilityLabel={t('live.speakerCalibration.startAccessibilityLabel')}
            >
              <Text style={styles.doneText}>{t('common.actions.gotIt')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: palette.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  card: {
    width: '100%',
    borderRadius: radii.xxl,
    padding: spacing.xxl + 4,
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
    alignItems: 'center',
    gap: spacing.lg,
    ...shadows.cardLg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.displaySm,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  instruction: {
    ...typography.bodyMd,
    lineHeight: 22,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    height: 40,
    marginVertical: spacing.sm,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: palette.accentDark,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: palette.bgGhostButton,
    alignItems: 'center',
  },
  skipText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
  },
  doneText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: palette.textOnAccent,
  },
});

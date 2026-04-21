import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type StartSessionCardProps = {
  onStart: () => void;
  dailyMinutesUsed: number;
  dailyMinutesLimit: number;
  isLimitReached: boolean;
  selectedScene: string;
};

export function StartSessionCard({
  onStart,
  dailyMinutesUsed,
  dailyMinutesLimit,
  isLimitReached,
  selectedScene,
}: StartSessionCardProps) {
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.7);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.4);
  const mountOpacity = useSharedValue(0);
  const mountY = useSharedValue(20);

  useEffect(() => {
    mountOpacity.value = withTiming(1, { duration: 500 });
    mountY.value = withSpring(0, { damping: 18, stiffness: 120 });

    if (!isLimitReached) {
      scale.value = withRepeat(
        withTiming(1.07, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      ringScale.value = withRepeat(
        withTiming(1.6, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      ringOpacity.value = withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      ring2Scale.value = withRepeat(
        withTiming(2.1, { duration: 2800, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      ring2Opacity.value = withRepeat(
        withTiming(0, { duration: 2800, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    }
  }, [isLimitReached, mountOpacity, mountY, ring2Opacity, ring2Scale, ringOpacity, ringScale, scale]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }], opacity: ringOpacity.value }));
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ scale: ring2Scale.value }], opacity: ring2Opacity.value }));
  const mountStyle = useAnimatedStyle(() => ({ opacity: mountOpacity.value, transform: [{ translateY: mountY.value }] }));

  const remaining = dailyMinutesLimit - dailyMinutesUsed;
  const usedPct = Math.min(dailyMinutesUsed / Math.max(dailyMinutesLimit, 1), 1);

  return (
    <Animated.View style={[styles.wrapper, mountStyle]}>
      {/* Scene badge */}
      <View style={styles.sceneBadge}>
        <View style={styles.sceneDot} />
        <Feather name="compass" size={12} color={palette.accentDark} />
        <Text style={styles.sceneText}>{selectedScene}</Text>
      </View>

      {/* Mic button with glow rings */}
      <View style={styles.micArea}>
        {!isLimitReached && (
          <Animated.View style={[styles.pulseRingBase, styles.pulseRingOuter, ring2Style]} />
        )}
        {!isLimitReached && (
          <Animated.View style={[styles.pulseRingBase, styles.pulseRingInner, ringStyle]} />
        )}
        <View style={[styles.glowRing, styles.glowRingOuter]} />
        <View style={[styles.glowRing, styles.glowRingMid]} />

        <Pressable onPress={onStart} accessibilityLabel="Start conversation" disabled={isLimitReached}>
          <Animated.View style={[!isLimitReached && pulseStyle]}>
            <View style={[styles.micButton, isLimitReached && styles.micButtonDisabled]}>
              <LinearGradient
                colors={isLimitReached ? [palette.disabledBg, palette.disabledBgEnd] : [palette.accent, palette.accentGradientEnd]}
                style={styles.micGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Feather
                  name={isLimitReached ? "lock" : "mic"}
                  size={36}
                  color={isLimitReached ? palette.disabledText : palette.accentDeep}
                />
              </LinearGradient>
            </View>
          </Animated.View>
        </Pressable>

        {!isLimitReached && (
          <>
            <View style={[styles.floatingTag, styles.floatingTagLeft]}>
              <View style={styles.floatingTagDot} />
              <Text style={styles.floatingTagText}>AI-powered</Text>
            </View>
            <View style={[styles.floatingTag, styles.floatingTagRight]}>
              <View style={styles.floatingTagDot} />
              <Text style={styles.floatingTagText}>Real-time</Text>
            </View>
          </>
        )}
      </View>

      {/* Label */}
      <View style={styles.labelBlock}>
        <Text style={styles.title}>
          {isLimitReached ? "Daily limit reached" : "Start Conversation"}
        </Text>
        <Text style={styles.subtitle}>
          {isLimitReached ? "Upgrade to Pro for 120 min/day" : "Tap to begin your live session"}
        </Text>
      </View>

      {/* Usage card */}
      <View style={styles.usageCard}>
        <View style={styles.usageRow}>
          <View style={styles.usageLabelRow}>
            <Feather name="clock" size={12} color={palette.textSecondary} />
            <Text style={styles.usageLabel}>Daily usage</Text>
          </View>
          <Text style={[styles.usageValue, isLimitReached && styles.usageValueLimit]}>
            {isLimitReached ? "Limit reached" : `${remaining} min left`}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={isLimitReached ? [palette.dangerGradientStart, palette.danger] : [palette.accent, palette.accentGradientEnd]}
            style={[styles.progressFill, { width: `${usedPct * 100}%` as `${number}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
        <Text style={styles.usageSub}>
          {dailyMinutesUsed} / {dailyMinutesLimit} min used today
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.xxxl,
    backgroundColor: palette.bgBase,
  },
  sceneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: palette.accentMutedMid,
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
  },
  sceneDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.accentDark,
  },
  sceneText: {
    ...typography.labelMd,
    color: palette.accentDark,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  micArea: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingBase: {
    position: "absolute",
    borderRadius: radii.pill,
  },
  pulseRingInner: {
    width: 110,
    height: 110,
    borderWidth: 2,
    borderColor: palette.accent,
  },
  pulseRingOuter: {
    width: 110,
    height: 110,
    borderWidth: 1.5,
    borderColor: palette.accent,
  },
  glowRing: {
    position: "absolute",
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  glowRingOuter: {
    width: 170,
    height: 170,
    borderColor: `${palette.accent}22`,
  },
  glowRingMid: {
    width: 130,
    height: 130,
    borderColor: `${palette.accent}38`,
  },
  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: "hidden",
    ...shadows.mic,
  },
  micButtonDisabled: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  micGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingTag: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: palette.accentMuted,
  },
  floatingTagLeft: {
    bottom: 10,
    left: -10,
  },
  floatingTagRight: {
    top: 10,
    right: -10,
  },
  floatingTagDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.accent,
  },
  floatingTagText: {
    ...typography.labelSm,
    color: palette.accentDark,
    letterSpacing: 0.3,
  },
  labelBlock: {
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  title: {
    ...typography.displayMd,
    color: palette.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.bodySm,
    color: palette.textSecondary,
    textAlign: "center",
  },
  usageCard: {
    width: "100%",
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentMutedStrong,
    gap: spacing.sm + 2,
    ...shadows.usageCard,
  },
  usageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  usageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  usageLabel: {
    ...typography.labelMd,
    color: palette.textSecondary,
  },
  usageValue: {
    ...typography.labelMd,
    color: palette.textAccent,
  },
  usageValueLimit: {
    color: palette.danger,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.neutralTrack,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  usageSub: {
    ...typography.caption,
    color: palette.textTertiary,
  },
});

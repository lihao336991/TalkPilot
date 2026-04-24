import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STAGE_PARTICLES = [
  { left: 26, top: 42, size: 4, phase: 0.12, distance: 8, alpha: 0.28 },
  { left: 196, top: 26, size: 5, phase: 0.44, distance: 10, alpha: 0.24 },
  { left: 222, top: 184, size: 4, phase: 0.76, distance: 8, alpha: 0.22 },
  { left: 32, top: 198, size: 5, phase: 0.58, distance: 10, alpha: 0.2 },
] as const;

type StartSessionCardProps = {
  onStart: () => void;
  onCancelStart: () => void;
  dailyMinutesUsed: number;
  dailyMinutesLimit: number;
  isLimitReached: boolean;
  selectedScene: string;
  startState: "idle" | "preparing" | "connecting" | "finalizing";
};

export function StartSessionCard({
  onStart,
  onCancelStart,
  dailyMinutesUsed,
  dailyMinutesLimit,
  isLimitReached,
  selectedScene,
  startState,
}: StartSessionCardProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const orbScale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.7);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.4);
  const mountOpacity = useSharedValue(0);
  const mountY = useSharedValue(20);
  const contentOpacity = useSharedValue(1);
  const contentScale = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);
  const stageOpacity = useSharedValue(0);
  const statusDotScale = useSharedValue(1);
  const statusDotOpacity = useSharedValue(0.8);
  const particleProgress = useSharedValue(0);
  const sweepProgress = useSharedValue(0);
  const stageGlowScale = useSharedValue(1);
  const stageGlowOpacity = useSharedValue(0.36);
  const isStarting = startState !== "idle";

  useEffect(() => {
    mountOpacity.value = withTiming(1, { duration: 500 });
    mountY.value = withSpring(0, { damping: 18, stiffness: 120 });
  }, [mountOpacity, mountY]);

  useEffect(() => {
    cancelAnimation(orbScale);
    cancelAnimation(ringScale);
    cancelAnimation(ringOpacity);
    cancelAnimation(ring2Scale);
    cancelAnimation(ring2Opacity);
    cancelAnimation(contentOpacity);
    cancelAnimation(contentScale);
    cancelAnimation(contentTranslateY);
    cancelAnimation(scrimOpacity);
    cancelAnimation(stageOpacity);
    cancelAnimation(statusDotScale);
    cancelAnimation(statusDotOpacity);
    cancelAnimation(particleProgress);
    cancelAnimation(sweepProgress);
    cancelAnimation(stageGlowScale);
    cancelAnimation(stageGlowOpacity);

    if (isStarting) {
      contentOpacity.value = withTiming(0, { duration: 180 });
      contentScale.value = withTiming(1, { duration: 180 });
      contentTranslateY.value = withTiming(0, { duration: 180 });
      scrimOpacity.value = withTiming(1, { duration: 420 });
      stageOpacity.value = withTiming(1, { duration: 280 });
      orbScale.value = withRepeat(
        withTiming(1.035, { duration: 1450, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      ringScale.value = withRepeat(
        withTiming(1.42, { duration: 2100, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      ringOpacity.value = withRepeat(
        withTiming(0.12, { duration: 2100, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      ring2Scale.value = withRepeat(
        withTiming(1.82, { duration: 2600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      ring2Opacity.value = withRepeat(
        withTiming(0, { duration: 2600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
      stageGlowScale.value = withRepeat(
        withTiming(1.08, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      stageGlowOpacity.value = withRepeat(
        withTiming(0.32, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      statusDotScale.value = withRepeat(
        withTiming(1.22, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      statusDotOpacity.value = withRepeat(
        withTiming(0.38, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      particleProgress.value = withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      );
      sweepProgress.value = withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      );
      return;
    }

    if (!isLimitReached) {
      contentOpacity.value = withTiming(1, { duration: 220 });
      contentScale.value = withTiming(1, { duration: 220 });
      contentTranslateY.value = withTiming(0, { duration: 220 });
      scrimOpacity.value = withTiming(0, { duration: 220 });
      stageOpacity.value = withTiming(0, { duration: 220 });
      orbScale.value = withRepeat(
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
      stageGlowScale.value = withTiming(1, { duration: 180 });
      stageGlowOpacity.value = withTiming(0.36, { duration: 180 });
      statusDotScale.value = 1;
      statusDotOpacity.value = 0.8;
      particleProgress.value = 0;
      sweepProgress.value = 0;
      return;
    }

    contentOpacity.value = withTiming(1, { duration: 180 });
    contentScale.value = withTiming(1, { duration: 180 });
    contentTranslateY.value = withTiming(0, { duration: 180 });
    scrimOpacity.value = withTiming(0, { duration: 180 });
    stageOpacity.value = withTiming(0, { duration: 180 });
    orbScale.value = withTiming(1, { duration: 180 });
    ringScale.value = withTiming(1, { duration: 180 });
    ringOpacity.value = withTiming(0, { duration: 180 });
    ring2Scale.value = withTiming(1, { duration: 180 });
    ring2Opacity.value = withTiming(0, { duration: 180 });
    stageGlowScale.value = withTiming(1, { duration: 180 });
    stageGlowOpacity.value = withTiming(0.3, { duration: 180 });
    statusDotScale.value = withTiming(1, { duration: 180 });
    statusDotOpacity.value = withTiming(0.8, { duration: 180 });
    particleProgress.value = 0;
    sweepProgress.value = 0;
  }, [
    contentOpacity,
    contentScale,
    contentTranslateY,
    isLimitReached,
    isStarting,
    orbScale,
    particleProgress,
    ring2Opacity,
    ring2Scale,
    ringOpacity,
    ringScale,
    scrimOpacity,
    stageGlowOpacity,
    stageGlowScale,
    stageOpacity,
    statusDotOpacity,
    statusDotScale,
    sweepProgress,
  ]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }], opacity: ringOpacity.value }));
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ scale: ring2Scale.value }], opacity: ring2Opacity.value }));
  const mountStyle = useAnimatedStyle(() => ({ opacity: mountOpacity.value, transform: [{ translateY: mountY.value }] }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      { translateY: contentTranslateY.value },
      { scale: contentScale.value },
    ],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));
  const stageStyle = useAnimatedStyle(() => ({
    opacity: stageOpacity.value,
  }));
  const statusDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statusDotScale.value }],
    opacity: statusDotOpacity.value,
  }));
  const stageGlowStyle = useAnimatedStyle(() => ({
    opacity: stageGlowOpacity.value,
    transform: [{ scale: stageGlowScale.value }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(sweepProgress.value, [0, 1], [-150, 150]),
      },
      { rotate: "24deg" },
    ],
    opacity: interpolate(sweepProgress.value, [0, 0.2, 0.5, 1], [0, 0.22, 0.1, 0]),
  }));

  const remaining = dailyMinutesLimit - dailyMinutesUsed;
  const usedPct = Math.min(dailyMinutesUsed / Math.max(dailyMinutesLimit, 1), 1);
  const isIdle = startState === "idle";

  const connectionCopy = useMemo(() => {
    switch (startState) {
      case "preparing":
        return {
          badge: t("live.startSession.connectingPreparing"),
          title: t("live.startSession.titlePreparing"),
          subtitle: t("live.startSession.subtitlePreparing"),
        };
      case "connecting":
        return {
          badge: t("live.startSession.connectingOpening"),
          title: t("live.startSession.titleConnecting"),
          subtitle: t("live.startSession.subtitleConnecting"),
        };
      case "finalizing":
        return {
          badge: t("live.startSession.connectingFinalizing"),
          title: t("live.startSession.titleFinalizing"),
          subtitle: t("live.startSession.subtitleFinalizing"),
        };
      default:
        return null;
    }
  }, [startState, t]);

  const overlayFrameStyle = useMemo(
    () => ({
      top: -insets.top,
      left: 0,
      right: 0,
      bottom: 0,
    }),
    [insets.top],
  );

  return (
    <Animated.View style={[styles.wrapper, mountStyle]}>
      <Animated.View style={[styles.contentShell, contentStyle]}>
        {/* TODO 二期：Scene Recommendation — 接入 sceneCatalog 推荐结果后恢复场景选择 UI
            参考文档：.trae/documents/Coach与Scene Recommendation方案.md
        */}
        {false && (
          <View style={styles.sceneBadge}>
            <View style={styles.sceneDot} />
            <Feather name="compass" size={12} color={palette.accentDark} />
            <Text style={styles.sceneText}>{selectedScene}</Text>
          </View>
        )}

        <View style={styles.micArea}>
          {!isLimitReached && (
            <Animated.View
              style={[styles.pulseRingBase, styles.pulseRingOuter, ring2Style]}
            />
          )}
          {!isLimitReached && (
            <Animated.View
              style={[styles.pulseRingBase, styles.pulseRingInner, ringStyle]}
            />
          )}
          <View style={[styles.glowRing, styles.glowRingOuter]} />
          <View style={[styles.glowRing, styles.glowRingMid]} />

          <Pressable
            onPress={onStart}
            accessibilityLabel={t("live.startSession.accessibilityLabel")}
            disabled={isLimitReached || isStarting}
          >
            <Animated.View style={[!isLimitReached && pulseStyle]}>
              <View style={[styles.micButton, isLimitReached && styles.micButtonDisabled]}>
                <LinearGradient
                  colors={
                    isLimitReached
                      ? [palette.disabledBg, palette.disabledBgEnd]
                      : [palette.accent, palette.accentGradientEnd]
                  }
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

          {!isLimitReached && !isStarting ? (
            <>
              <View style={[styles.floatingTag, styles.floatingTagLeft]}>
                <View style={styles.floatingTagDot} />
                <Text style={styles.floatingTagText}>{t("common.labels.aiPowered")}</Text>
              </View>
              <View style={[styles.floatingTag, styles.floatingTagRight]}>
                <View style={styles.floatingTagDot} />
                <Text style={styles.floatingTagText}>{t("common.labels.realTime")}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.labelBlock}>
          <Text style={styles.title}>
            {isLimitReached
              ? t("live.startSession.titleLimit")
              : t("live.startSession.titleReady")}
          </Text>
          <Text style={styles.subtitle}>
            {isLimitReached
              ? t("live.startSession.subtitleLimit")
              : t("live.startSession.subtitleReady")}
          </Text>
        </View>

        <View style={styles.usageCard}>
          <View style={styles.usageRow}>
            <View style={styles.usageLabelRow}>
              <Feather name="clock" size={12} color={palette.textSecondary} />
              <Text style={styles.usageLabel}>{t("live.startSession.usageLabel")}</Text>
            </View>
            <Text style={[styles.usageValue, isLimitReached && styles.usageValueLimit]}>
              {isLimitReached
                ? t("live.startSession.usageLimitReached")
                : t("live.startSession.usageRemaining", { count: remaining })}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={
                isLimitReached
                  ? [palette.dangerGradientStart, palette.danger]
                  : [palette.accent, palette.accentGradientEnd]
              }
              style={[
                styles.progressFill,
                { width: `${usedPct * 100}%` as `${number}%` },
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.usageSub}>
            {t("live.startSession.usageSummary", {
              used: dailyMinutesUsed,
              limit: dailyMinutesLimit,
            })}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={isStarting ? "auto" : "none"}
        style={[styles.overlayLayer, overlayFrameStyle, scrimStyle]}
      >
        <View style={styles.overlayBackdrop} />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(7,12,20,0.24)", "rgba(7,12,20,0.08)", "rgba(7,12,20,0)"]}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.overlayTopVeil}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(7,12,20,0)", "rgba(7,12,20,0.08)", "rgba(7,12,20,0.26)"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.overlayBottomVeil}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(212,255,117,0.08)", "rgba(255,255,255,0.025)", "rgba(15,23,42,0)"]}
          locations={[0, 0.42, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overlayTint}
        />
        <Animated.View style={[styles.stageGlow, styles.stageGlowOuter, stageGlowStyle]} />

        <Animated.View style={[styles.stageWrap, stageStyle]}>
          <View style={styles.stageParticleField}>
            {STAGE_PARTICLES.map((particle) => (
              <AmbientParticle
                key={`${particle.left}-${particle.top}`}
                particle={particle}
                progress={particleProgress}
              />
            ))}
          </View>

          <View style={styles.heroCluster}>
            <Animated.View
              style={[styles.stagePulseRing, styles.stagePulseRingOuter, ring2Style]}
            />
            <Animated.View
              style={[styles.stagePulseRing, styles.stagePulseRingInner, ringStyle]}
            />
            <Animated.View style={[styles.stageOrb, pulseStyle]}>
              <View style={styles.stageOrbShell}>
                <LinearGradient
                  colors={["rgba(230,255,156,0.94)", palette.accent, "#9BCB10"]}
                  start={{ x: 0.15, y: 0.05 }}
                  end={{ x: 0.85, y: 0.95 }}
                  style={styles.stageOrbGradient}
                >
                  <View style={styles.stageInnerHighlight} />
                  <AnimatedLinearGradient
                    colors={[
                      "rgba(255,255,255,0)",
                      "rgba(255,255,255,0.56)",
                      "rgba(255,255,255,0)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.sweepLight, sweepStyle]}
                  />
                  <Feather
                    name="mic"
                    size={52}
                    color={palette.accentDeep}
                    style={styles.stageMicIcon}
                  />
                </LinearGradient>
              </View>
            </Animated.View>
          </View>

          {connectionCopy ? (
            <>
              <View style={styles.floatingBadge}>
                <Animated.View style={[styles.connectingBadgeDot, statusDotStyle]} />
                <Text style={styles.floatingBadgeText}>{connectionCopy.badge}</Text>
              </View>
              <Text style={styles.floatingTitle}>{connectionCopy.title}</Text>
              <Pressable
                onPress={onCancelStart}
                accessibilityRole="button"
                accessibilityLabel={t("live.startSession.cancelAccessibilityLabel")}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>{t("common.actions.cancel")}</Text>
              </Pressable>
            </>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function AmbientParticle({
  particle,
  progress,
}: {
  particle: (typeof STAGE_PARTICLES)[number];
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const shifted = (progress.value + particle.phase) % 1;
    return {
      opacity: interpolate(
        shifted,
        [0, 0.5, 1],
        [particle.alpha * 0.55, particle.alpha, particle.alpha * 0.45],
      ),
      transform: [
        { translateY: interpolate(shifted, [0, 0.5, 1], [0, -particle.distance, 0]) },
        { scale: interpolate(shifted, [0, 0.5, 1], [0.85, 1.15, 0.9]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.stageParticle,
        {
          left: particle.left,
          top: particle.top,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: "relative",
    backgroundColor: palette.bgBase,
  },
  contentShell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.xxxl,
  },
  overlayLayer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    position: "absolute",
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,16,26,0.16)",
  },
  overlayTopVeil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.42,
  },
  overlayBottomVeil: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.44,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
  },
  stageGlow: {
    position: "absolute",
    borderRadius: radii.circle,
    backgroundColor: "rgba(194,234,69,0.08)",
  },
  stageGlowOuter: {
    width: 296,
    height: 296,
  },
  stageWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  stageParticleField: {
    position: "absolute",
    width: 238,
    height: 238,
  },
  stageParticle: {
    position: "absolute",
    backgroundColor: "rgba(245,255,220,0.95)",
    shadowColor: "#F8FFE4",
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  heroCluster: {
    width: 236,
    height: 236,
    alignItems: "center",
    justifyContent: "center",
  },
  stagePulseRing: {
    position: "absolute",
    borderRadius: radii.circle,
    borderColor: "rgba(215,249,105,0.72)",
  },
  stagePulseRingInner: {
    width: 164,
    height: 164,
    borderWidth: 1.1,
  },
  stagePulseRingOuter: {
    width: 206,
    height: 206,
    borderWidth: 0.8,
  },
  stageOrb: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: "center",
    justifyContent: "center",
  },
  stageOrbShell: {
    width: "100%",
    height: "100%",
    borderRadius: 63,
    padding: 1.5,
    backgroundColor: "rgba(255,255,255,0.12)",
    shadowColor: "#DFFF6E",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  stageOrbGradient: {
    flex: 1,
    borderRadius: 63,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stageInnerHighlight: {
    position: "absolute",
    top: 14,
    width: 82,
    height: 28,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  sweepLight: {
    position: "absolute",
    width: 50,
    height: 190,
  },
  stageMicIcon: {
    opacity: 0.95,
  },
  floatingBadge: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  floatingBadgeText: {
    ...typography.labelMd,
    color: "rgba(255,255,255,0.9)",
  },
  floatingTitle: {
    marginTop: 16,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
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
  connectingBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D9FF6C",
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
  cancelButton: {
    marginTop: 16,
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cancelButtonText: {
    ...typography.labelMd,
    color: "rgba(255,255,255,0.92)",
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

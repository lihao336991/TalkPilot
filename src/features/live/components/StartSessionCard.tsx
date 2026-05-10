import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
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

// ─── iCloud-style orbit dots ring ────────────────────────────────────────────
const ORBIT_OUTER_COUNT = 22;
const ORBIT_INNER_COUNT = 22;
const ORBIT_OUTER_RADIUS = 105;
const ORBIT_INNER_RADIUS = 87;
const ORBIT_OUTER_DOT = 8.5;
const ORBIT_INNER_DOT = 5.5;
const ORBIT_CONTAINER = 224; // fits inside heroCluster (236×236)
const ORBIT_CX = ORBIT_CONTAINER / 2;
const ORBIT_CY = ORBIT_CONTAINER / 2;
// Color spectrum: TalkPilot lime → teal → blue → indigo → purple → pink → coral → amber → lime
const ORBIT_COLORS = [
  '#C2EA45', '#9FE03D', '#56D77A', '#2ED4B0',
  '#38C4E8', '#4AACFF', '#6B86FF', '#9B73F0',
  '#C56CE8', '#F472B6', '#FF8A6E', '#FBBB44',
  '#D9E830',
] as const;

function getOrbitColor(angleDeg: number): string {
  const t = ((angleDeg % 360) + 360) % 360 / 360;
  const lo = Math.floor(t * ORBIT_COLORS.length) % ORBIT_COLORS.length;
  return ORBIT_COLORS[lo];
}

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
  const orbitProgress = useSharedValue(0);
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
    cancelAnimation(orbitProgress);

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
      orbitProgress.value = withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }

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
    orbitProgress.value = 0;
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
    orbitProgress,
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
          {!isStarting && (
            <Animated.View
              style={[styles.pulseRingBase, styles.pulseRingOuter, ring2Style]}
            />
          )}
          {!isStarting && (
            <Animated.View
              style={[styles.pulseRingBase, styles.pulseRingInner, ringStyle]}
            />
          )}
          <View style={[styles.glowRing, styles.glowRingOuter]} />
          <View style={[styles.glowRing, styles.glowRingMid]} />

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onStart();
            }}
            accessibilityLabel={t("live.startSession.accessibilityLabel")}
            disabled={isStarting}
          >
            <Animated.View style={pulseStyle}>
              <View style={styles.micButton}>
                <LinearGradient
                  colors={[palette.accent, palette.accentGradientEnd]}
                  style={styles.micGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather
                    name="mic"
                    size={36}
                    color={palette.accentDeep}
                  />
                </LinearGradient>
              </View>
            </Animated.View>
          </Pressable>

          {!isStarting ? (
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
        <BlurView intensity={28} tint="light" style={styles.overlayBlur} />
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(212,255,117,0.22)",
            "rgba(194,234,69,0.12)",
            "rgba(134,174,0,0.08)",
            "rgba(242,255,220,0.04)",
          ]}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.overlayGradient}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
          locations={[0, 0.45]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.overlayHighlight}
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
            <OrbitDotsRing progress={orbitProgress} />
            <Animated.View style={[styles.stageOrb, pulseStyle]}>
              <View style={styles.stageOrbShell}>
                <BlurView intensity={36} tint="light" style={styles.stageOrbBlur}>
                  <View style={styles.stageOrbInner} />
                </BlurView>
                <View style={styles.stageOrbHighlight} />
                <Feather
                  name="mic"
                  size={48}
                  color="rgba(86,126,0,0.82)"
                  style={styles.stageMicIcon}
                />
              </View>
            </Animated.View>
          </View>

          {connectionCopy ? (
            <>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onCancelStart();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("live.startSession.cancelAccessibilityLabel")}
                style={styles.glassButtonWrap}
              >
                <BlurView intensity={32} tint="light" style={styles.glassButtonBlur}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={[
                      "rgba(255,255,255,0.82)",
                      "rgba(248,252,240,0.64)",
                    ]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.glassButtonContent}>
                    <Feather
                      name="x-circle"
                      size={17}
                      color="rgba(86,126,0,0.74)"
                    />
                    <Text style={styles.glassButtonText}>
                      {t("common.actions.cancel")}
                    </Text>
                  </View>
                </BlurView>
                <View style={styles.glassButtonBorder} />
              </Pressable>
              <Text style={styles.stageStatusText}>{connectionCopy.badge}</Text>
            </>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function OrbitDotsRing({ progress }: { progress: SharedValue<number> }) {
  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  const dots = useMemo(() => {
    const result: Array<{
      x: number; y: number; size: number; color: string; opacity: number; key: string;
    }> = [];

    for (let i = 0; i < ORBIT_OUTER_COUNT; i++) {
      // Start from top (-PI/2) and go clockwise
      const angle = (i / ORBIT_OUTER_COUNT) * 2 * Math.PI - Math.PI / 2;
      const x = ORBIT_CX + ORBIT_OUTER_RADIUS * Math.cos(angle);
      const y = ORBIT_CY + ORBIT_OUTER_RADIUS * Math.sin(angle);
      const angleDeg = (i / ORBIT_OUTER_COUNT) * 360;
      // Subtle opacity variation: brightest at top (angle=-PI/2), dimmer at bottom
      const opacityPhase = (Math.cos(angle + Math.PI) + 1) / 2;
      const opacity = 0.55 + 0.35 * opacityPhase;
      result.push({ x, y, size: ORBIT_OUTER_DOT, color: getOrbitColor(angleDeg), opacity, key: `o${i}` });
    }

    for (let i = 0; i < ORBIT_INNER_COUNT; i++) {
      // Offset by half a step to stagger between outer dots — creates 3D donut depth
      const angle = ((i + 0.5) / ORBIT_INNER_COUNT) * 2 * Math.PI - Math.PI / 2;
      const x = ORBIT_CX + ORBIT_INNER_RADIUS * Math.cos(angle);
      const y = ORBIT_CY + ORBIT_INNER_RADIUS * Math.sin(angle);
      const angleDeg = ((i + 0.5) / ORBIT_INNER_COUNT) * 360;
      const opacityPhase = (Math.cos(angle + Math.PI) + 1) / 2;
      const opacity = 0.38 + 0.28 * opacityPhase;
      result.push({ x, y, size: ORBIT_INNER_DOT, color: getOrbitColor(angleDeg), opacity, key: `i${i}` });
    }

    return result;
  }, []);

  return (
    <Animated.View
      style={[
        { width: ORBIT_CONTAINER, height: ORBIT_CONTAINER, position: "absolute" },
        rotateStyle,
      ]}
    >
      {dots.map((dot) => (
        <View
          key={dot.key}
          style={{
            position: "absolute",
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: dot.color,
            left: dot.x - dot.size / 2,
            top: dot.y - dot.size / 2,
            opacity: dot.opacity,
          }}
        />
      ))}
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
  overlayBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  stageGlow: {
    position: "absolute",
    borderRadius: radii.circle,
    backgroundColor: "rgba(194,234,69,0.14)",
  },
  stageGlowOuter: {
    width: 320,
    height: 320,
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
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  stageOrbShell: {
    width: "100%",
    height: "100%",
    borderRadius: 58,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 0.8,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: "#86AE00",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    alignItems: "center",
    justifyContent: "center",
  },
  stageOrbBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  stageOrbInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(242,255,218,0.28)",
  },
  stageOrbHighlight: {
    position: "absolute",
    top: 10,
    width: 64,
    height: 22,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  stageMicIcon: {
    opacity: 0.95,
  },
  // ─── Liquid glass cancel button ──────────────────────────────────────────────
  glassButtonWrap: {
    marginTop: 28,
    borderRadius: radii.pill,
    overflow: "hidden",
    shadowColor: "#587600",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  glassButtonBlur: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  glassButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  glassButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(134,174,0,0.16)",
  },
  glassButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(42,62,0,0.74)",
    letterSpacing: 0.2,
  },
  stageStatusText: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(86,126,0,0.5)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
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

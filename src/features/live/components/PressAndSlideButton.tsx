import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type PressAndSlideAction = "cancel" | "send" | "speak";

type PressAndSlideButtonProps = {
  icon?: keyof typeof Feather.glyphMap;
  label?: string;
  defaultColor: string;
  activeColor: string;
  defaultBg: string;
  activeBg: string;
  cancelBg: string;
  sendBg: string;
  onPressIn: () => void;
  onPressOut: (action: PressAndSlideAction) => void;
  previewText?: string;
  slideThresholdLeft?: number;
  slideThresholdRight?: number;
  buttonStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  neutralHint?: string;
  showHoldRipple?: boolean;
  rippleColor?: string;
  overlayTitle?: string;
  overlaySubtitle?: string;
};

export function PressAndSlideButton({
  icon,
  label,
  defaultColor,
  activeColor,
  defaultBg,
  activeBg,
  cancelBg,
  sendBg,
  onPressIn,
  onPressOut,
  previewText,
  slideThresholdLeft = -60,
  slideThresholdRight = 60,
  buttonStyle,
  labelStyle,
  neutralHint,
  showHoldRipple = false,
  rippleColor = "rgba(194,234,69,0.34)",
  overlayTitle,
  overlaySubtitle,
}: PressAndSlideButtonProps) {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const [actionState, setActionState] = useState<"neutral" | "cancel" | "speak">(
    "neutral",
  );

  const dragX = useSharedValue(0);
  const rippleProgress = useSharedValue(0);
  const rippleProgressSecondary = useSharedValue(0);
  const overlayVisible = isActive;

  const iconColor = useMemo(() => {
    if (!isActive) return defaultColor;
    return activeColor;
  }, [activeColor, defaultColor, isActive]);

  const handleRelease = (finalAction: "neutral" | "cancel" | "speak") => {
    if (finalAction === "cancel") {
      onPressOut("cancel");
      return;
    }
    onPressOut(finalAction === "speak" ? "speak" : "send");
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsActive)(true);
      runOnJS(setActionState)("neutral");
      runOnJS(onPressIn)();
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;

      if (event.translationX < slideThresholdLeft) {
        runOnJS(setActionState)("cancel");
      } else if (event.translationX > slideThresholdRight) {
        runOnJS(setActionState)("speak");
      } else {
        runOnJS(setActionState)("neutral");
      }
    })
    .onEnd(() => {
      let finalAction: "neutral" | "cancel" | "speak" = "neutral";
      if (dragX.value < slideThresholdLeft) finalAction = "cancel";
      else if (dragX.value > slideThresholdRight) finalAction = "speak";

      runOnJS(handleRelease)(finalAction);
    })
    .onFinalize(() => {
      runOnJS(setIsActive)(false);
      runOnJS(setActionState)("neutral");
      dragX.value = withSpring(0);
    });

  const animatedButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: isActive ? activeBg : defaultBg,
  }));

  const animatedBubbleStyle = useAnimatedStyle(() => {
    const clampedX = Math.max(-120, Math.min(120, dragX.value));

    let bgColor = activeBg;
    if (actionState === "cancel") bgColor = cancelBg;
    if (actionState === "speak") bgColor = sendBg;

    const bubbleScale = actionState === "neutral" ? 1 : 1.05;

    return {
      transform: [{ translateX: clampedX * 0.88 }, { scale: bubbleScale }],
      backgroundColor: bgColor,
    };
  });

  const bubbleStyle = useMemo(() => {
    if (actionState === "cancel") {
      return styles.voiceBubbleCancel;
    }

    return actionState === "speak" || actionState === "neutral"
      ? styles.voiceBubbleText
      : styles.voiceBubbleSend;
  }, [actionState]);

  const bubbleText = useMemo(() => {
    const trimmed = previewText?.trim();
    if (trimmed) {
      return trimmed;
    }
    if (actionState === "speak") {
      return t("live.pressAndSlide.speakReplyFallback");
    }
    return "";
  }, [actionState, previewText, t]);

  useEffect(() => {
    if (overlayVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [overlayVisible]);

  useEffect(() => {
    if (isActive && showHoldRipple) {
      rippleProgress.value = 0;
      rippleProgressSecondary.value = 0;
      rippleProgress.value = withRepeat(
        withTiming(1, {
          duration: 1400,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false,
      );
      rippleProgressSecondary.value = withDelay(
        240,
        withRepeat(
          withTiming(1, {
            duration: 1400,
            easing: Easing.out(Easing.quad),
          }),
          -1,
          false,
        ),
      );
      return;
    }

    cancelAnimation(rippleProgress);
    cancelAnimation(rippleProgressSecondary);
    rippleProgress.value = 0;
    rippleProgressSecondary.value = 0;
  }, [isActive, rippleProgress, rippleProgressSecondary, showHoldRipple]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: showHoldRipple && isActive ? 0.2 * (1 - rippleProgress.value) : 0,
    transform: [{ scale: 0.92 + rippleProgress.value * 0.95 }],
  }));

  const rippleSecondaryStyle = useAnimatedStyle(() => ({
    opacity:
      showHoldRipple && isActive ? 0.14 * (1 - rippleProgressSecondary.value) : 0,
    transform: [{ scale: 0.92 + rippleProgressSecondary.value * 1.1 }],
  }));

  return (
    <View style={[styles.container, overlayVisible && styles.containerActive]}>
      <Modal
        visible={overlayVisible}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <Animated.View
          style={styles.overlay}
          pointerEvents="none"
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          <View style={styles.scrim} />

          <Animated.View
            style={styles.overlayContentWrap}
            entering={SlideInDown.duration(300)
              .withInitialValues({ transform: [{ translateY: 6 }], opacity: 0 })
              .easing(Easing.out(Easing.ease))}
            exiting={SlideOutDown.duration(150)}
          >
            {(overlayTitle || overlaySubtitle) && actionState === "neutral" ? (
              <View style={styles.overlayHeaderCard}>
                {overlayTitle ? (
                  <Text style={styles.overlayHeaderTitle}>{overlayTitle}</Text>
                ) : null}
                {overlaySubtitle ? (
                  <Text style={styles.overlayHeaderSubtitle}>{overlaySubtitle}</Text>
                ) : null}
              </View>
            ) : null}

            <Animated.View
              style={[styles.voiceBubble, bubbleStyle, animatedBubbleStyle]}
            >
              {actionState !== "cancel" && bubbleText ? (
                <>
                  <Text
                    style={styles.voiceBubbleTextContent}
                    numberOfLines={actionState === "neutral" ? 4 : 3}
                  >
                    {bubbleText}
                  </Text>
                  <View style={styles.voiceBubbleMetaRow}>
                    <View style={styles.waveformCornerInline}>
                      <WaveformBars color="rgba(32,72,17,0.72)" compact />
                    </View>
                    {actionState === "speak" ? (
                      <View style={styles.speakBadge}>
                        <Feather name="volume-2" size={14} color="#173300" />
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <WaveformBars
                  color={
                    actionState === "cancel"
                      ? "rgba(118,12,14,0.82)"
                      : "rgba(36,78,21,0.78)"
                  }
                  compact={actionState === "cancel"}
                />
              )}
              <View
                style={[
                  styles.voiceBubbleTail,
                  actionState === "cancel"
                    ? styles.voiceBubbleTailCancel
                    : styles.voiceBubbleTailSend,
                ]}
              />
            </Animated.View>
          </Animated.View>

          <View style={styles.bottomPanel}>
            <Animated.View
              style={styles.arcShape}
              entering={SlideInDown.duration(300)
                .withInitialValues({ transform: [{ translateY: 20 }] })
                .easing(Easing.out(Easing.quad))}
              exiting={SlideOutDown.duration(150)}
            />
            <Animated.View
              style={styles.actionsRow}
              entering={SlideInDown.duration(250)
                .delay(50)
                .withInitialValues({ transform: [{ translateY: 15 }] })
                .easing(Easing.out(Easing.quad))}
              exiting={SlideOutDown.duration(150)}
            >
              <View style={styles.actionColumn}>
                <Text
                  style={[
                    styles.actionHint,
                    actionState !== "cancel" && { opacity: 0 },
                  ]}
                >
                  {t("live.pressAndSlide.releaseCancel")}
                </Text>
                <View
                  style={[
                    styles.actionPill,
                    actionState === "cancel" && styles.actionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionPillText,
                      actionState === "cancel" && styles.actionPillTextActive,
                    ]}
                  >
                    {t("live.pressAndSlide.cancel")}
                  </Text>
                </View>
              </View>

              <View style={styles.actionColumn}>
                <Text
                  style={[
                    styles.actionHint,
                    actionState !== "speak" && { opacity: 0 },
                  ]}
                >
                  {t("live.pressAndSlide.releaseSpeakReply")}
                </Text>
                <View
                  style={[
                    styles.actionPill,
                    actionState === "speak" && styles.actionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionPillText,
                      actionState === "speak" && styles.actionPillTextActive,
                    ]}
                  >
                    {t("live.pressAndSlide.slideToSpeak")}
                  </Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              style={styles.bottomCenterContent}
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(150)}
            >
              <Text
                style={[
                  styles.centerHint,
                  actionState !== "neutral" && { opacity: 0 },
                ]}
              >
                {neutralHint ?? t("live.pressAndSlide.releaseSend")}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.button, animatedButtonStyle, buttonStyle]}>
          {showHoldRipple ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.holdRipple,
                  { backgroundColor: rippleColor },
                  rippleStyle,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.holdRipple,
                  styles.holdRippleSecondary,
                  { borderColor: rippleColor },
                  rippleSecondaryStyle,
                ]}
              />
            </>
          ) : null}
          {label ? (
            <Text style={[styles.buttonLabel, { color: iconColor }, labelStyle]}>{label}</Text>
          ) : icon ? (
            <Feather name={icon} size={24} color={iconColor} />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function WaveformBars({
  color,
  compact = false,
}: {
  color: string;
  compact?: boolean;
}) {
  const bars = compact ? [10, 14, 18, 24, 18, 14, 10] : WAVEFORM_BARS;
  return (
    <View style={styles.waveformRow}>
      {bars.map((height, index) => (
        <View
          key={`${height}-${index}`}
          style={[
            styles.waveformBar,
            {
              height,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const WAVEFORM_BARS = [8, 10, 14, 18, 24, 18, 12, 8, 10, 14, 18, 24, 18, 12, 8];

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
  },
  containerActive: {
    zIndex: 999,
  },
  button: {
    width: 50,
    height: 50,
    borderRadius: 25,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.08)",
  },
  holdRipple: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  holdRippleSecondary: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  overlay: {
    flex: 1,
    zIndex: 900,
    elevation: 20,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,20,22,0.62)",
  },
  overlayContentWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 262,
    alignItems: "center",
    gap: 14,
  },
  overlayHeaderCard: {
    width: SCREEN_WIDTH - 56,
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  overlayHeaderTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  overlayHeaderSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
  },
  voiceBubble: {
    minWidth: 140,
    maxWidth: SCREEN_WIDTH - 52,
    minHeight: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  voiceBubbleSend: {
    backgroundColor: "#92EA63",
  },
  voiceBubbleCancel: {
    width: 80,
    minWidth: 80,
    height: 80,
    minHeight: 80,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 24,
    backgroundColor: "#FF5A58",
  },
  voiceBubbleText: {
    alignItems: "flex-start",
    backgroundColor: "#92EA63",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 24,
    minWidth: 140,
    minHeight: 88,
  },
  voiceBubbleTail: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 16,
    transform: [{ rotate: "45deg" }],
    borderRadius: 3,
    zIndex: -1,
  },
  voiceBubbleTailSend: {
    backgroundColor: "#92EA63",
  },
  voiceBubbleTailCancel: {
    backgroundColor: "#FF5A58",
  },
  voiceBubbleTextContent: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500",
    color: "#0F1808",
    maxWidth: SCREEN_WIDTH - 110,
  },
  voiceBubbleMetaRow: {
    width: "100%",
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  waveformCornerInline: {
    minHeight: 16,
    justifyContent: "center",
  },
  speakBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,24,8,0.1)",
  },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
  arcShape: {
    position: "absolute",
    left: -(SCREEN_WIDTH * 1.5 - SCREEN_WIDTH / 2),
    width: SCREEN_WIDTH * 3,
    height: SCREEN_WIDTH * 3,
    borderRadius: SCREEN_WIDTH * 1.5,
    top: 60,
    backgroundColor: "#2C2C2E",
  },
  bottomCenterContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: "center",
  },
  centerHint: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  actionsRow: {
    position: "absolute",
    left: 32,
    right: 32,
    top: -40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  actionColumn: {
    alignItems: "center",
  },
  actionHint: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  actionPill: {
    height: 56,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  actionPillActive: {
    backgroundColor: "#FFFFFF",
  },
  actionPillText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  actionPillTextActive: {
    color: "#000000",
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
});

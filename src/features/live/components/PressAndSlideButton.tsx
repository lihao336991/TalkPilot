import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Modal, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type PressAndSlideAction = "cancel" | "send" | "text";

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
}: PressAndSlideButtonProps) {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const [actionState, setActionState] = useState<"neutral" | "cancel" | "text">(
    "neutral",
  );

  const dragX = useSharedValue(0);
  const overlayVisible = isActive;

  const iconColor = useMemo(() => {
    if (!isActive) return defaultColor;
    return activeColor;
  }, [activeColor, defaultColor, isActive]);

  const handleRelease = (finalAction: "neutral" | "cancel" | "text") => {
    if (finalAction === "cancel") {
      onPressOut("cancel");
      return;
    }
    onPressOut(finalAction === "text" ? "text" : "send");
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
        runOnJS(setActionState)("text");
      } else {
        runOnJS(setActionState)("neutral");
      }
    })
    .onEnd(() => {
      let finalAction: "neutral" | "cancel" | "text" = "neutral";
      if (dragX.value < slideThresholdLeft) finalAction = "cancel";
      else if (dragX.value > slideThresholdRight) finalAction = "text";

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
    if (actionState === "text") bgColor = sendBg;

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

    if (actionState === "text") {
      return styles.voiceBubbleText;
    }

    return styles.voiceBubbleSend;
  }, [actionState]);

  const bubbleText = useMemo(() => {
    if (actionState === "text") {
      const trimmed = previewText?.trim();
      return trimmed || t("live.pressAndSlide.editDraftFallback");
    }

    return "";
  }, [actionState, previewText, t]);

  useEffect(() => {
    if (overlayVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [overlayVisible]);

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
            style={styles.voiceBubbleWrap}
            entering={SlideInDown.duration(300)
              .withInitialValues({ transform: [{ translateY: 6 }], opacity: 0 })
              .easing(Easing.out(Easing.ease))}
            exiting={SlideOutDown.duration(150)}
          >
            <Animated.View
              style={[styles.voiceBubble, bubbleStyle, animatedBubbleStyle]}
            >
              {actionState === "text" ? (
                <>
                  <Text style={styles.voiceBubbleTextContent} numberOfLines={3}>
                    {bubbleText}
                  </Text>
                  <View style={styles.waveformCorner}>
                    <WaveformBars color="rgba(32,72,17,0.8)" compact />
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
                    actionState !== "text" && { opacity: 0 },
                  ]}
                >
                  {t("live.pressAndSlide.releaseEditText")}
                </Text>
                <View
                  style={[
                    styles.actionPill,
                    actionState === "text" && styles.actionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionPillText,
                      actionState === "text" && styles.actionPillTextActive,
                    ]}
                  >
                    {t("live.pressAndSlide.slideToText")}
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
                {t("live.pressAndSlide.releaseSend")}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.button, animatedButtonStyle]}>
          {label ? (
            <Text style={[styles.buttonLabel, { color: iconColor }]}>{label}</Text>
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.08)",
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
  voiceBubbleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 270,
    alignItems: "center",
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
    paddingRight: 40,
    paddingBottom: 16,
  },
  waveformCorner: {
    position: "absolute",
    right: 16,
    bottom: 16,
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

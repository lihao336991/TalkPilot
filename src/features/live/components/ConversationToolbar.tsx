import { palette, spacing } from "@/shared/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAudioInputStore } from "../store/audioInputStore";
import {
  PressAndSlideAction,
  PressAndSlideButton,
} from "./PressAndSlideButton";

type ConversationToolbarProps = {
  copilotEnabled: boolean;
  onToggleCopilot: () => void;
  onEnd: () => void;
  onNativeAssistPressIn: () => void;
  onNativeAssistPressOut: (action: PressAndSlideAction) => void;
  assistPreviewText?: string;
};

export function ConversationToolbar({
  copilotEnabled,
  onToggleCopilot,
  onEnd,
  onNativeAssistPressIn,
  onNativeAssistPressOut,
  assistPreviewText,
}: ConversationToolbarProps) {
  const { t } = useTranslation();
  const assistAudioLevel = useAudioInputStore((s) => s.assistLevel);
  const hasAssistInput = useAudioInputStore((s) => s.hasAssistInput);
  const starRotation = useSharedValue(0);

  useEffect(() => {
    if (copilotEnabled) {
      starRotation.value = withRepeat(
        withTiming(360, {
          duration: 2400,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
      return;
    }

    cancelAnimation(starRotation);
    starRotation.value = withTiming(0, { duration: 180 });
  }, [copilotEnabled, starRotation]);

  const orbitingStarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${starRotation.value}deg` }],
  }));
  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.controlTouch}
          onPress={onToggleCopilot}
          accessibilityRole="switch"
          accessibilityState={{ checked: copilotEnabled }}
          accessibilityLabel={t("live.toolbar.copilotAccessibility", {
            state: copilotEnabled
              ? t("live.toolbar.copilotOn")
              : t("live.toolbar.copilotOff"),
          })}
        >
          <View
            style={[
              styles.controlButton,
              styles.copilotButton,
              copilotEnabled
                ? styles.copilotButtonActive
                : styles.copilotButtonInactive,
            ]}
          >
            <Text
              style={[
                styles.copilotText,
                copilotEnabled
                  ? styles.copilotTextActive
                  : styles.copilotTextInactive,
              ]}
            >
              AI
            </Text>
            {copilotEnabled ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.copilotOrbit, orbitingStarStyle]}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={11}
                  color="#FFFFFF"
                />
              </Animated.View>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.centerSlot}>
          <PressAndSlideButton
            label="SOS"
            defaultColor={palette.textSecondary}
            activeColor="#FFFFFF"
            defaultBg="rgba(244,248,239,0.9)"
            activeBg={palette.accentDark}
            cancelBg="#FF5A58"
            sendBg={palette.accent}
            onPressIn={onNativeAssistPressIn}
            onPressOut={onNativeAssistPressOut}
            previewText={assistPreviewText}
            slideThresholdLeft={-72}
            slideThresholdRight={72}
            buttonStyle={[styles.controlButton, styles.assistButton]}
            activeButtonStyle={styles.assistButtonActive}
            activeContainerStyle={styles.assistActiveGlow}
            labelStyle={styles.assistLabel}
            neutralHint={t("live.pressAndSlide.releaseCancelOrSlideSpeak")}
            showHoldRipple
            rippleColor="rgba(194,234,69,0.34)"
            overlayTitle={t("live.toolbar.assistOverlayTitle")}
            overlaySubtitle={t("live.toolbar.assistOverlaySubtitle")}
            energyLevel={hasAssistInput ? assistAudioLevel : 0}
            showActiveEnergy={hasAssistInput}
          />
        </View>

        <Pressable
          style={styles.controlTouch}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onEnd();
          }}
          accessibilityLabel={t("live.toolbar.endConversation")}
        >
          <View style={[styles.controlButton, styles.endBtnInner]}>
            <MaterialCommunityIcons
              name="phone-hangup"
              size={20}
              color="#FFFFFF"
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: 28,
    borderRadius: 34,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(250,252,247,0.84)",
    borderWidth: 1,
    borderColor: "rgba(134,174,0,0.12)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlTouch: {
    width: 84,
    alignItems: "center",
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  copilotButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  copilotButtonActive: {
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: palette.accentDark,
    shadowColor: palette.accentDark,
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  copilotButtonInactive: {
    borderColor: "rgba(15,23,42,0.05)",
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  copilotText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  copilotTextActive: {
    color: "#FFFFFF",
  },
  copilotTextInactive: {
    color: "rgba(15,23,42,0.52)",
  },
  copilotOrbit: {
    position: "absolute",
    left: -6,
    top: -6,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    paddingTop: 1,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.9,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  endBtnInner: {
    backgroundColor: palette.danger,
    borderColor: "rgba(220,38,38,0.85)",
    shadowColor: palette.danger,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  assistButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: "rgba(134,174,0,0.14)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  assistButtonActive: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  assistActiveGlow: {
    shadowColor: "#86AE00",
    shadowOpacity: 0.48,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  assistLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
});

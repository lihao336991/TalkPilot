import { palette, spacing, typography } from "@/shared/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ConversationFlow } from "../components/ConversationFlow";
import { ConversationToolbar } from "../components/ConversationToolbar";
import { FloatingSimulateButton } from "../components/FloatingSimulateButton";
import { SpeakerCalibration } from "../components/SpeakerCalibration";
import { StartSessionCard } from "../components/StartSessionCard";
import SuggestionPanel from "../components/SuggestionPanel";
import { VoiceEnrollmentCard } from "../components/VoiceEnrollmentCard";

import { DebugOverlay } from "../components/DebugOverlay";
import { useLiveSessionController } from "../hooks/useLiveSessionController";
import { useAudioInputStore } from "../store/audioInputStore";

import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";
import { AiDataConsentModal } from "@/features/privacy/components/AiDataConsentModal";
import { useAiConsentState } from "@/features/privacy/useAiConsentState";
import { useRouter } from "expo-router";

const DECOR_GRID_LINES = [0, 1, 2, 3, 4, 5];
const DECOR_GRID_COLUMNS = [0, 1, 2, 3];

type ClosedOrbit = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  phase: number;
  frequencyX: number;
  frequencyY: number;
  wobbleX: number;
  wobbleY: number;
  wobblePhase: number;
  wobbleFrequencyX: number;
  wobbleFrequencyY: number;
  scaleBase: number;
  scaleAmp: number;
};

function resolveClosedOrbit(progress: number, orbit: ClosedOrbit) {
  "worklet";

  const angle = progress * Math.PI * 2 + orbit.phase;
  const baseAngle = progress * Math.PI * 2;
  const xAngle = baseAngle * orbit.frequencyX + orbit.phase;
  const yAngle = baseAngle * orbit.frequencyY + orbit.phase * 0.7;
  const wobbleXAngle =
    baseAngle * orbit.wobbleFrequencyX + orbit.wobblePhase;
  const wobbleYAngle =
    baseAngle * orbit.wobbleFrequencyY + orbit.wobblePhase * 1.3;

  return {
    x:
      orbit.centerX +
      Math.cos(xAngle) * orbit.radiusX +
      Math.cos(wobbleXAngle) * orbit.wobbleX,
    y:
      orbit.centerY +
      Math.sin(yAngle) * orbit.radiusY +
      Math.sin(wobbleYAngle) * orbit.wobbleY,
    scale: orbit.scaleBase + Math.sin(angle + Math.PI / 3) * orbit.scaleAmp,
  };
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const hasMainInput = useAudioInputStore((s) => s.hasMainInput);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isAcceptingConsent, setIsAcceptingConsent] = useState(false);
  const [shouldResumeStartAfterConsent, setShouldResumeStartAfterConsent] =
    useState(false);
  const topWashShift = useSharedValue(0);
  const bubbleLeftShift = useSharedValue(0);
  const bubbleHaloShift = useSharedValue(0);
  const bubbleCenterShift = useSharedValue(0);
  const bubbleMainShift = useSharedValue(0);
  const bubbleRightShift = useSharedValue(0);

  const {
    scenePreset,
    dailyMinutesUsed,
    dailyMinutesLimit,
    isDailyLimitReached,
    isListening,
    forcedSpeaker,
    copilotEnabled,
    copilotToastState,
    showEnrollment,
    showCalibration,
    remainingSessionSeconds,
    shouldShowSessionTimeoutCountdown,
    assistPreviewText,
    isSendingSuggestion,
    isIdle,
    isActive,
    startSessionUiState,
    handleStartSession,
    handleCancelStartSession,
    handleEnrollmentComplete,
    handleEnrollmentSkip,
    handleCalibrationComplete,
    handleCalibrationSkip,
    handleSimulateOtherPressIn,
    handleSimulateOtherPressOut,
    handleToggleCopilot,
    handleSendSuggestion,
    handleNativeAssistPressIn,
    handleNativeAssistPressOut,
    handleRestartMainMicrophone,
    handleEnd,
  } = useLiveSessionController();
  const { checked: aiConsentChecked, hasAccepted, accept } = useAiConsentState();

  const bottomPadding =
    isActive || startSessionUiState !== "idle"
      ? 0
      : getTabBarHeight(insets.bottom);

  const handleStartPress = async () => {
    if (!aiConsentChecked) {
      return;
    }

    if (hasAccepted) {
      await handleStartSession();
      return;
    }

    setShouldResumeStartAfterConsent(true);
    setShowConsentModal(true);
  };

  const handleCloseConsentModal = () => {
    setShowConsentModal(false);
    setShouldResumeStartAfterConsent(false);
    setIsAcceptingConsent(false);
  };

  const openLegalFromConsent = (path: "/privacy" | "/terms") => {
    handleCloseConsentModal();
    setTimeout(() => {
      router.push(path);
    }, 0);
  };

  const handleAcceptConsent = async () => {
    if (isAcceptingConsent) {
      return;
    }

    setIsAcceptingConsent(true);
    try {
      await accept();
      setShowConsentModal(false);
      if (shouldResumeStartAfterConsent) {
        setShouldResumeStartAfterConsent(false);
        await handleStartSession();
      }
    } finally {
      setIsAcceptingConsent(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(topWashShift);
      cancelAnimation(bubbleLeftShift);
      cancelAnimation(bubbleHaloShift);
      cancelAnimation(bubbleCenterShift);
      cancelAnimation(bubbleMainShift);
      cancelAnimation(bubbleRightShift);
      topWashShift.value = 0.45;
      bubbleLeftShift.value = 0.32;
      bubbleHaloShift.value = 0.58;
      bubbleCenterShift.value = 0.2;
      bubbleMainShift.value = 0.72;
      bubbleRightShift.value = 0.44;
      return;
    }

    topWashShift.value = withRepeat(
      withTiming(1, {
        duration: 45000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    bubbleLeftShift.value = withRepeat(
      withTiming(1, {
        duration: 45067,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    bubbleHaloShift.value = withRepeat(
      withTiming(1, {
        duration: 53733,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    bubbleCenterShift.value = withRepeat(
      withTiming(1, {
        duration: 48533,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    bubbleMainShift.value = withRepeat(
      withTiming(1, {
        duration: 41600,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    bubbleRightShift.value = withRepeat(
      withTiming(1, {
        duration: 43333,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [
    bubbleCenterShift,
    bubbleHaloShift,
    bubbleLeftShift,
    bubbleMainShift,
    bubbleRightShift,
    reduceMotion,
    topWashShift,
  ]);

  const topBackdropStyle = useAnimatedStyle(() => {
    const progress = topWashShift.value;
    return {
      opacity: 0.84,
      transform: [
        { translateX: interpolate(progress, [0, 0.5, 1], [-10, 8, -10]) },
        { translateY: interpolate(progress, [0, 0.5, 1], [-4, 4, -4]) },
        { scale: interpolate(progress, [0, 0.5, 1], [1.04, 1.1, 1.04]) },
      ],
    };
  });

  const topBubbleDriftStyle = useAnimatedStyle(() => {
    const progress = bubbleMainShift.value;
    const orbit = resolveClosedOrbit(progress, {
      centerX: 28,
      centerY: 10,
      radiusX: 104,
      radiusY: 58,
      phase: 0.9,
      frequencyX: 7,
      frequencyY: 5,
      wobbleX: 42,
      wobbleY: 30,
      wobblePhase: 1.7,
      wobbleFrequencyX: 11,
      wobbleFrequencyY: 9,
      scaleBase: 1.02,
      scaleAmp: 0.06,
    });
    return {
      opacity: 0.54 + Math.sin(progress * Math.PI * 2 + 0.4) * 0.07,
      transform: [
        { translateX: orbit.x },
        { translateY: orbit.y },
        { scale: orbit.scale },
      ],
    };
  });

  const topBubbleHaloStyle = useAnimatedStyle(() => {
    const progress = bubbleHaloShift.value;
    const orbit = resolveClosedOrbit(progress, {
      centerX: 88,
      centerY: 18,
      radiusX: 132,
      radiusY: 42,
      phase: 2.2,
      frequencyX: 5,
      frequencyY: 7,
      wobbleX: 48,
      wobbleY: 34,
      wobblePhase: 0.3,
      wobbleFrequencyX: 9,
      wobbleFrequencyY: 11,
      scaleBase: 1.02,
      scaleAmp: 0.05,
    });
    return {
      opacity: 0.36 + Math.sin(progress * Math.PI * 2 + 1.1) * 0.04,
      transform: [
        { translateX: orbit.x },
        { translateY: orbit.y },
        { scale: orbit.scale },
      ],
    };
  });

  const topBubbleLeftStyle = useAnimatedStyle(() => {
    const progress = bubbleLeftShift.value;
    const orbit = resolveClosedOrbit(progress, {
      centerX: 58,
      centerY: 20,
      radiusX: 118,
      radiusY: 70,
      phase: 3.8,
      frequencyX: 7,
      frequencyY: 9,
      wobbleX: 52,
      wobbleY: 38,
      wobblePhase: 2.4,
      wobbleFrequencyX: 13,
      wobbleFrequencyY: 5,
      scaleBase: 1.01,
      scaleAmp: 0.06,
    });
    return {
      opacity: 0.46 + Math.sin(progress * Math.PI * 2 + 2.2) * 0.06,
      transform: [
        { translateX: orbit.x },
        { translateY: orbit.y },
        { scale: orbit.scale },
      ],
    };
  });

  const topBubbleCenterStyle = useAnimatedStyle(() => {
    const progress = bubbleCenterShift.value;
    const orbit = resolveClosedOrbit(progress, {
      centerX: -18,
      centerY: -6,
      radiusX: 96,
      radiusY: 76,
      phase: 1.4,
      frequencyX: 9,
      frequencyY: 7,
      wobbleX: 44,
      wobbleY: 40,
      wobblePhase: 3.1,
      wobbleFrequencyX: 5,
      wobbleFrequencyY: 11,
      scaleBase: 1,
      scaleAmp: 0.06,
    });
    return {
      opacity: 0.43 + Math.sin(progress * Math.PI * 2 + 2.7) * 0.06,
      transform: [
        { translateX: orbit.x },
        { translateY: orbit.y },
        { scale: orbit.scale },
      ],
    };
  });

  const topBubbleRightStyle = useAnimatedStyle(() => {
    const progress = bubbleRightShift.value;
    const orbit = resolveClosedOrbit(progress, {
      centerX: -70,
      centerY: 16,
      radiusX: 112,
      radiusY: 64,
      phase: 4.9,
      frequencyX: 5,
      frequencyY: 9,
      wobbleX: 46,
      wobbleY: 32,
      wobblePhase: 1.1,
      wobbleFrequencyX: 11,
      wobbleFrequencyY: 7,
      scaleBase: 1.02,
      scaleAmp: 0.06,
    });
    return {
      opacity: 0.4 + Math.sin(progress * Math.PI * 2 + 0.9) * 0.05,
      transform: [
        { translateX: orbit.x },
        { translateY: orbit.y },
        { scale: orbit.scale },
      ],
    };
  });

  const topSweepStyle = useAnimatedStyle(() => {
    const progress = topWashShift.value;
    return {
      opacity: 0.05 + progress * 0.03,
      transform: [{ translateY: -44 + progress * 88 }, { scaleY: 1.08 }],
    };
  });

  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: bottomPadding }]}
      edges={["top"]}
    >
      <DebugOverlay onRestartMainMicrophone={handleRestartMainMicrophone} />
      {isIdle && (
        <>
          <StartSessionCard
            onStart={() => {
              void handleStartPress();
            }}
            onCancelStart={handleCancelStartSession}
            dailyMinutesUsed={dailyMinutesUsed}
            dailyMinutesLimit={dailyMinutesLimit}
            isLimitReached={isDailyLimitReached}
            selectedScene={scenePreset}
            startState={startSessionUiState}
          />
        </>
      )}

      {isActive && (
        <View style={styles.activeContainer}>
          {shouldShowSessionTimeoutCountdown &&
          remainingSessionSeconds != null ? (
            <View
              style={[
                styles.countdownWrap,
                { top: Math.max(insets.top, 16) + 8 },
              ]}
            >
              <View style={styles.countdownCard}>
                <Text style={styles.countdownEyebrow}>
                  {t("live.sessionLimit.warningEyebrow")}
                </Text>
                <Text style={styles.countdownText}>
                  {t("live.sessionLimit.warningBody", {
                    time: formatCountdown(remainingSessionSeconds),
                  })}
                </Text>
              </View>
            </View>
          ) : null}
          {isListening && hasMainInput ? (
            <View pointerEvents="none" style={styles.listeningOverlay}>
              {/* <SkiaListeningWave
                level={mainAudioLevel}
                style={styles.listeningWave}
              /> */}
            </View>
          ) : null}
          <View
            pointerEvents="none"
            style={[
              styles.liveTopWash,
              { top: -insets.top, height: insets.top + 268 },
            ]}
          >
            <Animated.View style={[styles.liveTopBackdrop, topBackdropStyle]}>
              <LinearGradient
                colors={[
                  "rgba(230,247,222,0.72)",
                  "rgba(211,241,197,0.58)",
                  "rgba(176,226,174,0.28)",
                  "rgba(156,229,204,0.1)",
                  "rgba(243,247,238,0)",
                ]}
                locations={[0, 0.3, 0.58, 0.82, 1]}
                start={{ x: 0.34, y: 0 }}
                end={{ x: 0.74, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <LinearGradient
              colors={[
                "rgba(207,239,125,0.08)",
                "rgba(134,174,0,0.04)",
                "rgba(243,247,238,0)",
              ]}
              locations={[0, 0.46, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.liveTopGlowVeil}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.liveTopSweep, topSweepStyle]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0)",
                  "rgba(180,255,236,0.12)",
                  "rgba(255,255,255,0)",
                ]}
                locations={[0, 0.5, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <View style={styles.liveTopGrid}>
              {DECOR_GRID_LINES.map((line) => (
                <View
                  key={`row-${line}`}
                  style={[styles.liveTopGridRow, { top: 30 + line * 32 }]}
                />
              ))}
              {DECOR_GRID_COLUMNS.map((line) => (
                <View
                  key={`col-${line}`}
                  style={[
                    styles.liveTopGridColumn,
                    { left: `${18 + line * 22}%` },
                  ]}
                />
              ))}
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.liveTopBubbleLeft, topBubbleLeftStyle]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.26)",
                  "rgba(143,255,226,0.28)",
                  "rgba(66,202,185,0.08)",
                  "rgba(255,255,255,0)",
                ]}
                locations={[0, 0.24, 0.68, 1]}
                start={{ x: 0.16, y: 0.08 }}
                end={{ x: 0.84, y: 0.92 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.liveTopBubbleLensCore} />
              <View style={styles.liveTopBubbleLensShadow} />
              <View
                style={[
                  styles.liveTopBubbleCrescent,
                  styles.liveTopBubbleCrescentLeft,
                ]}
              />
              <View style={styles.liveTopBubbleInnerGlow} />
              <View
                style={[
                  styles.liveTopBubbleSpecular,
                  styles.liveTopBubbleSpecularLarge,
                ]}
              />
              <View
                style={[
                  styles.liveTopBubbleRefraction,
                  styles.liveTopBubbleRefractionLeft,
                ]}
              />
              <View style={styles.liveTopBubbleRing} />
              <View
                style={[
                  styles.liveTopBubbleGlint,
                  styles.liveTopBubbleGlintWide,
                ]}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.liveTopBubbleHalo, topBubbleHaloStyle]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0)",
                  "rgba(165,255,236,0.2)",
                  "rgba(83,220,200,0.09)",
                  "rgba(255,255,255,0)",
                ]}
                locations={[0, 0.34, 0.56, 1]}
                start={{ x: 0.08, y: 0.15 }}
                end={{ x: 0.9, y: 0.86 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.liveTopBubbleLensCoreSoft} />
              <View
                style={[
                  styles.liveTopBubbleCrescent,
                  styles.liveTopBubbleCrescentHalo,
                ]}
              />
              <View style={styles.liveTopBubbleInnerGlowSoft} />
              <View
                style={[
                  styles.liveTopBubbleRefraction,
                  styles.liveTopBubbleRefractionHalo,
                ]}
              />
              <View style={styles.liveTopBubbleRingSoft} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.liveTopBubbleCenter, topBubbleCenterStyle]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.24)",
                  "rgba(136,255,229,0.24)",
                  "rgba(44,184,176,0.08)",
                  "rgba(255,255,255,0)",
                ]}
                locations={[0, 0.22, 0.68, 1]}
                start={{ x: 0.24, y: 0.1 }}
                end={{ x: 0.86, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.liveTopBubbleLensCore} />
              <View style={styles.liveTopBubbleLensShadow} />
              <View
                style={[
                  styles.liveTopBubbleCrescent,
                  styles.liveTopBubbleCrescentCenter,
                ]}
              />
              <View style={styles.liveTopBubbleInnerGlow} />
              <View
                style={[
                  styles.liveTopBubbleSpecular,
                  styles.liveTopBubbleSpecularMedium,
                ]}
              />
              <View
                style={[
                  styles.liveTopBubbleRefraction,
                  styles.liveTopBubbleRefractionCenter,
                ]}
              />
              <View style={styles.liveTopBubbleRing} />
              <View
                style={[
                  styles.liveTopBubbleGlint,
                  styles.liveTopBubbleGlintLong,
                ]}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.liveTopBubble, topBubbleDriftStyle]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.25)",
                  "rgba(118,255,226,0.24)",
                  "rgba(53,184,174,0.08)",
                  "rgba(255,255,255,0)",
                ]}
                locations={[0, 0.24, 0.66, 1]}
                start={{ x: 0.18, y: 0.1 }}
                end={{ x: 0.86, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.liveTopBubbleLensCoreSoft} />
              <View
                style={[
                  styles.liveTopBubbleCrescent,
                  styles.liveTopBubbleCrescentMain,
                ]}
              />
              <View style={styles.liveTopBubbleInnerGlowSoft} />
              <View
                style={[
                  styles.liveTopBubbleRefraction,
                  styles.liveTopBubbleRefractionMain,
                ]}
              />
              <View
                style={[
                  styles.liveTopBubbleSpecular,
                  styles.liveTopBubbleSpecularSmall,
                ]}
              />
              <View style={styles.liveTopBubbleRingSoft} />
              <View style={styles.liveTopBubbleGlint} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.liveTopBubbleRight, topBubbleRightStyle]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.2)",
                  "rgba(147,255,234,0.18)",
                  "rgba(255,255,255,0)",
                ]}
                locations={[0, 0.34, 1]}
                start={{ x: 0.12, y: 0.12 }}
                end={{ x: 0.86, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.liveTopBubbleLensCoreSoft} />
              <View
                style={[
                  styles.liveTopBubbleCrescent,
                  styles.liveTopBubbleCrescentRight,
                ]}
              />
              <View style={styles.liveTopBubbleInnerGlowSoft} />
              <View
                style={[
                  styles.liveTopBubbleSpecular,
                  styles.liveTopBubbleSpecularTiny,
                ]}
              />
              <View
                style={[
                  styles.liveTopBubbleRefraction,
                  styles.liveTopBubbleRefractionRight,
                ]}
              />
              <View style={styles.liveTopBubbleRingSoft} />
            </Animated.View>
            <View style={styles.liveTopScanTexture}>
              {DECOR_GRID_LINES.map((line) => (
                <View
                  key={`scan-${line}`}
                  style={[styles.liveTopScanLine, { top: 12 + line * 39 }]}
                />
              ))}
            </View>
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(243,247,238,0)",
                "rgba(243,247,238,0.5)",
                palette.bgBase,
              ]}
              locations={[0, 0.58, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.liveTopBottomFade}
            />
          </View>
          <ConversationFlow />
          <SuggestionPanel
            onSendSuggestion={handleSendSuggestion}
            isSendingSuggestion={isSendingSuggestion}
          />
          {__DEV__ ? (
            <FloatingSimulateButton
              onRecordStart={handleSimulateOtherPressIn}
              onRecordEnd={handleSimulateOtherPressOut}
              isRecording={forcedSpeaker === "other"}
              initialBottom={getTabBarHeight(insets.bottom) + 140}
              initialRight={20}
            />
          ) : null}
          <ConversationToolbar
            copilotEnabled={copilotEnabled}
            onToggleCopilot={handleToggleCopilot}
            onEnd={handleEnd}
            onNativeAssistPressIn={handleNativeAssistPressIn}
            onNativeAssistPressOut={handleNativeAssistPressOut}
            assistPreviewText={assistPreviewText}
          />
          {copilotToastState ? (
            <Animated.View
              entering={FadeInDown.duration(180)}
              exiting={FadeOutDown.duration(180)}
              style={styles.copilotToastWrap}
              pointerEvents="none"
            >
              <View style={styles.copilotToast}>
                <View
                  style={[
                    styles.copilotToastDot,
                    copilotToastState === "enabled"
                      ? styles.copilotToastDotEnabled
                      : styles.copilotToastDotDisabled,
                  ]}
                />
                <Text style={styles.copilotToastText}>
                  {copilotToastState === "enabled"
                    ? t("live.toolbar.copilotEnabledToast")
                    : t("live.toolbar.copilotDisabledToast")}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </View>
      )}

      <VoiceEnrollmentCard
        visible={showEnrollment}
        onComplete={handleEnrollmentComplete}
        onSkip={handleEnrollmentSkip}
      />

      <SpeakerCalibration
        visible={showCalibration}
        onComplete={handleCalibrationComplete}
        onSkip={handleCalibrationSkip}
      />

      <AiDataConsentModal
        visible={showConsentModal}
        hasAccepted={hasAccepted}
        isSaving={isAcceptingConsent}
        onAgree={() => {
          void handleAcceptConsent();
        }}
        onClose={handleCloseConsentModal}
        onOpenPrivacy={() => {
          openLegalFromConsent("/privacy");
        }}
        onOpenTerms={() => {
          openLegalFromConsent("/terms");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  activeContainer: {
    flex: 1,
  },
  countdownWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
    paddingHorizontal: spacing.lg,
  },
  countdownCard: {
    minWidth: 196,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,248,234,0.96)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  countdownEyebrow: {
    ...typography.caption,
    color: "#B45309",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  countdownText: {
    marginTop: 2,
    ...typography.caption,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  listeningOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  listeningWave: {
    width: 236,
    height: 76,
  },
  liveTopWash: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: palette.bgBase,
    zIndex: 0,
  },
  liveTopBackdrop: {
    position: "absolute",
    left: -28,
    right: -28,
    top: -18,
    bottom: -10,
  },
  liveTopGlowVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  liveTopGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  liveTopGridRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(134,174,0,0.05)",
  },
  liveTopGridColumn: {
    position: "absolute",
    top: 0,
    bottom: 36,
    width: 1,
    backgroundColor: "rgba(134,174,0,0.035)",
  },
  liveTopSweep: {
    position: "absolute",
    top: 0,
    left: "56%",
    width: 82,
    height: 220,
    borderRadius: 42,
    overflow: "hidden",
  },
  liveTopBubbleLeft: {
    position: "absolute",
    top: 44,
    left: -18,
    width: 124,
    height: 124,
    borderRadius: 62,
    overflow: "hidden",
    shadowColor: "#6FFFE0",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  liveTopBubbleHalo: {
    position: "absolute",
    top: 34,
    left: "12%",
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: "hidden",
  },
  liveTopBubbleCenter: {
    position: "absolute",
    top: 118,
    left: "38%",
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    shadowColor: "#2FE7D0",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  liveTopBubble: {
    position: "absolute",
    top: 70,
    left: "29%",
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
  },
  liveTopBubbleRight: {
    position: "absolute",
    top: 46,
    right: 18,
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    shadowColor: "#7FFFE6",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  liveTopBubbleRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(235,255,250,0.42)",
  },
  liveTopBubbleRingSoft: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "rgba(235,255,250,0.3)",
  },
  liveTopBubbleLensCore: {
    position: "absolute",
    top: "18%",
    left: "18%",
    width: "50%",
    height: "50%",
    borderRadius: 999,
    backgroundColor: "rgba(245,255,252,0.28)",
  },
  liveTopBubbleLensCoreSoft: {
    position: "absolute",
    top: "20%",
    left: "20%",
    width: "46%",
    height: "46%",
    borderRadius: 999,
    backgroundColor: "rgba(245,255,252,0.22)",
  },
  liveTopBubbleLensShadow: {
    position: "absolute",
    right: "10%",
    bottom: "8%",
    width: "38%",
    height: "38%",
    borderRadius: 999,
    backgroundColor: "rgba(178,255,239,0.1)",
  },
  liveTopBubbleCrescent: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: "rgba(242,255,252,0.24)",
    backgroundColor: "transparent",
  },
  liveTopBubbleCrescentLeft: {
    top: 8,
    left: 8,
    width: 78,
    height: 78,
    opacity: 0.5,
  },
  liveTopBubbleCrescentHalo: {
    top: 10,
    left: 10,
    width: 90,
    height: 90,
    opacity: 0.36,
  },
  liveTopBubbleCrescentCenter: {
    top: 8,
    left: 8,
    width: 76,
    height: 76,
    opacity: 0.46,
  },
  liveTopBubbleCrescentMain: {
    top: 7,
    left: 7,
    width: 66,
    height: 66,
    opacity: 0.4,
  },
  liveTopBubbleCrescentRight: {
    top: 5,
    left: 5,
    width: 44,
    height: 44,
    opacity: 0.42,
  },
  liveTopBubbleInnerGlow: {
    position: "absolute",
    top: "16%",
    left: "14%",
    width: "58%",
    height: "58%",
    borderRadius: 999,
    backgroundColor: "rgba(242,255,252,0.18)",
  },
  liveTopBubbleInnerGlowSoft: {
    position: "absolute",
    top: "18%",
    left: "16%",
    width: "52%",
    height: "52%",
    borderRadius: 999,
    backgroundColor: "rgba(242,255,252,0.14)",
  },
  liveTopBubbleSpecular: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.52)",
  },
  liveTopBubbleSpecularLarge: {
    top: 14,
    right: 14,
    width: 16,
    height: 16,
  },
  liveTopBubbleSpecularMedium: {
    top: 12,
    right: 12,
    width: 12,
    height: 12,
  },
  liveTopBubbleSpecularSmall: {
    top: 8,
    right: 12,
    width: 9,
    height: 9,
  },
  liveTopBubbleSpecularTiny: {
    top: 8,
    right: 9,
    width: 7,
    height: 7,
  },
  liveTopBubbleRefraction: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 999,
  },
  liveTopBubbleRefractionLeft: {
    right: -6,
    top: 20,
    width: 44,
    height: 44,
    transform: [{ rotate: "18deg" }],
    backgroundColor: "rgba(220,255,248,0.11)",
  },
  liveTopBubbleRefractionHalo: {
    left: "46%",
    top: 14,
    width: 34,
    height: 34,
    transform: [{ rotate: "20deg" }],
    backgroundColor: "rgba(220,255,248,0.09)",
  },
  liveTopBubbleRefractionCenter: {
    right: 6,
    top: 18,
    width: 34,
    height: 34,
    transform: [{ rotate: "18deg" }],
    backgroundColor: "rgba(220,255,248,0.11)",
  },
  liveTopBubbleRefractionMain: {
    right: 10,
    top: 14,
    width: 28,
    height: 28,
    transform: [{ rotate: "22deg" }],
    backgroundColor: "rgba(220,255,248,0.12)",
  },
  liveTopBubbleRefractionRight: {
    right: 6,
    top: 12,
    width: 18,
    height: 18,
    transform: [{ rotate: "20deg" }],
    backgroundColor: "rgba(220,255,248,0.1)",
  },
  liveTopBubbleGlint: {
    position: "absolute",
    top: 8,
    left: 16,
    width: 24,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  liveTopBubbleGlintWide: {
    top: 14,
    left: 18,
    width: 32,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  liveTopBubbleGlintLong: {
    top: 10,
    left: 18,
    width: 38,
    height: 7,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  liveTopScanTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
  },
  liveTopScanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(205,255,244,0.07)",
  },
  liveTopBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 112,
  },
  copilotToastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 112,
    alignItems: "center",
  },
  copilotToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(250,252,247,0.88)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  copilotToastDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  copilotToastDotEnabled: {
    backgroundColor: "#A6CE39",
  },
  copilotToastDotDisabled: {
    backgroundColor: "rgba(15,23,42,0.28)",
  },
  copilotToastText: {
    ...typography.caption,
    color: palette.textPrimary,
    fontWeight: "600",
  },
});

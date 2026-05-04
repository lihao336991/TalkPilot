import {
  palette,
  radii,
  shadows,
  spacing,
  typography,
} from "@/shared/theme/tokens";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ConversationFlow } from "../components/ConversationFlow";
import { ConversationToolbar } from "../components/ConversationToolbar";
import { FloatingSimulateButton } from "../components/FloatingSimulateButton";
import { SkiaListeningWave } from "../components/SkiaListeningWave";
import { SpeakerCalibration } from "../components/SpeakerCalibration";
import { StartSessionCard } from "../components/StartSessionCard";
import SuggestionPanel from "../components/SuggestionPanel";
import { VoiceEnrollmentCard } from "../components/VoiceEnrollmentCard";

import { DebugOverlay } from "../components/DebugOverlay";
import { useLiveSessionController } from "../hooks/useLiveSessionController";
import { useAudioInputStore } from "../store/audioInputStore";

import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const mainAudioLevel = useAudioInputStore((s) => s.mainLevel);
  const hasMainInput = useAudioInputStore((s) => s.hasMainInput);

  const {
    scenePreset,
    dailyMinutesUsed,
    dailyMinutesLimit,
    isDailyLimitReached,
    isListening,
    mainWsStatus,
    assistWsStatus,
    forcedSpeaker,
    copilotEnabled,
    copilotToastState,
    showEnrollment,
    showCalibration,
    assistPreviewText,
    isSendingSuggestion,
    isIdle,
    isActive,
    startSessionUiState,
    mainWsMeta,
    assistWsMeta,
    shouldShowAssistWs,
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

  const bottomPadding =
    isActive || startSessionUiState !== "idle"
      ? 0
      : getTabBarHeight(insets.bottom);

  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: bottomPadding }]}
      edges={["top"]}
    >
      <DebugOverlay onRestartMainMicrophone={handleRestartMainMicrophone} />
      {isIdle && (
        <>
          <StartSessionCard
            onStart={handleStartSession}
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
          {isListening && hasMainInput ? (
            <View pointerEvents="none" style={styles.listeningOverlay}>
              <SkiaListeningWave
                level={mainAudioLevel}
                style={styles.listeningWave}
              />
            </View>
          ) : null}
          <View style={styles.wsStatusCard}>
            <View
              style={[
                styles.wsStatusDot,
                { backgroundColor: mainWsMeta.color },
              ]}
            />
            <View style={styles.wsStatusTextWrap}>
              <View style={styles.wsStatusRow}>
                <Text style={styles.wsStatusLabel}>{mainWsMeta.label}</Text>
                <Text style={styles.wsStatusValue}>{mainWsStatus}</Text>
              </View>
              <Text style={styles.wsStatusHint}>
                {isListening
                  ? t("live.screen.wsHintListening")
                  : t("live.screen.wsHintInactive")}
              </Text>
              {shouldShowAssistWs ? (
                <View style={styles.assistWsRow}>
                  <View
                    style={[
                      styles.wsStatusDot,
                      styles.assistWsDot,
                      { backgroundColor: assistWsMeta.color },
                    ]}
                  />
                  <Text style={styles.assistWsLabel}>{assistWsMeta.label}</Text>
                  <Text style={styles.assistWsValue}>{assistWsStatus}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <ConversationFlow />
          <SuggestionPanel
            onSendSuggestion={handleSendSuggestion}
            isSendingSuggestion={isSendingSuggestion}
          />
          <FloatingSimulateButton
            onRecordStart={handleSimulateOtherPressIn}
            onRecordEnd={handleSimulateOtherPressOut}
            isRecording={forcedSpeaker === "other"}
            initialBottom={getTabBarHeight(insets.bottom) + 140}
            initialRight={20}
          />
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
  wsStatusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: spacing.lg,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: radii.md,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...shadows.cardSm,
  },
  wsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 10,
  },
  wsStatusTextWrap: {
    flex: 1,
  },
  wsStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  wsStatusLabel: {
    ...typography.labelMd,
    color: palette.textPrimary,
  },
  wsStatusValue: {
    ...typography.caption,
    color: palette.textTertiary,
    textTransform: "uppercase",
  },
  wsStatusHint: {
    marginTop: 3,
    ...typography.caption,
    color: palette.textTertiary,
  },
  assistWsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  assistWsDot: {
    marginTop: 0,
    marginRight: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  assistWsLabel: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  assistWsValue: {
    ...typography.caption,
    color: palette.textTertiary,
    textTransform: "uppercase",
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

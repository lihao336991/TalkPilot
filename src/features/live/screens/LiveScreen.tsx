import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();

  const {
    scenePreset,
    dailyMinutesUsed,
    dailyMinutesLimit,
    isDailyLimitReached,
    status,
    isListening,
    mainWsStatus,
    assistWsStatus,
    forcedSpeaker,
    duration,
    showEnrollment,
    showCalibration,
    assistState,
    assistPreviewText,
    assistDraftText,
    isAssistDraftVisible,
    setAssistDraftText,
    isIdle,
    isActive,
    mainWsMeta,
    assistWsMeta,
    shouldShowAssistWs,
    handleStartSession,
    handleEnrollmentComplete,
    handleEnrollmentSkip,
    handleCalibrationComplete,
    handleCalibrationSkip,
    handlePause,
    handleResume,
    handleSimulateOtherPressIn,
    handleSimulateOtherPressOut,
    handleNativeAssistPressIn,
    handleNativeAssistPressOut,
    handleEnd,
    dismissAssistDraft,
    submitAssistDraft,
  } = useLiveSessionController();

  const bottomPadding = isActive ? 0 : getTabBarHeight(insets.bottom);

  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: bottomPadding }]}
      edges={["top"]}
    >
      {isIdle && (
        <>
          <DebugOverlay inline />
          <StartSessionCard
            onStart={handleStartSession}
            dailyMinutesUsed={dailyMinutesUsed}
            dailyMinutesLimit={dailyMinutesLimit}
            isLimitReached={isDailyLimitReached}
            selectedScene={scenePreset}
          />
        </>
      )}

      {isActive && (
        <View style={styles.activeContainer}>
          <DebugOverlay inline />
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
                {isListening ? "Mic is sending audio" : "Mic is paused"}
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
          <SuggestionPanel />
          <FloatingSimulateButton
            onRecordStart={handleSimulateOtherPressIn}
            onRecordEnd={handleSimulateOtherPressOut}
            isRecording={forcedSpeaker === "other"}
            initialBottom={getTabBarHeight(insets.bottom) + 140}
            initialRight={20}
          />
          <ConversationToolbar
            onPause={handlePause}
            onResume={handleResume}
            onEnd={handleEnd}
            onNativeAssistPressIn={handleNativeAssistPressIn}
            onNativeAssistPressOut={handleNativeAssistPressOut}
            isPaused={status === "paused"}
            isNativeAssistActive={assistState === "recording"}
            assistPreviewText={assistPreviewText}
            duration={duration}
          />
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

      <Modal
        animationType="fade"
        transparent
        visible={isAssistDraftVisible}
        onRequestClose={() => {
          void dismissAssistDraft();
        }}
      >
        <View style={styles.assistDraftBackdrop}>
          <View style={styles.assistDraftCard}>
            <Text style={styles.assistDraftTitle}>Edit before sending</Text>
            <Text style={styles.assistDraftSubtitle}>
              Refine your text, then generate an English reply
            </Text>

            <TextInput
              value={assistDraftText}
              onChangeText={setAssistDraftText}
              style={styles.assistDraftInput}
              autoFocus
              multiline
              textAlignVertical="top"
              placeholder="Edit your speech into clearer text"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.assistDraftActions}>
              <Pressable
                style={[
                  styles.assistDraftButton,
                  styles.assistDraftGhostButton,
                ]}
                onPress={() => {
                  void dismissAssistDraft();
                }}
              >
                <Text
                  style={[
                    styles.assistDraftButtonText,
                    styles.assistDraftGhostButtonText,
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.assistDraftButton,
                  styles.assistDraftPrimaryButton,
                ]}
                onPress={() => {
                  void submitAssistDraft();
                }}
              >
                <Text style={styles.assistDraftButtonText}>Generate reply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  assistDraftBackdrop: {
    flex: 1,
    backgroundColor: palette.overlayDark,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  assistDraftCard: {
    borderRadius: radii.xl,
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
    padding: spacing.xl,
    ...shadows.cardLg,
  },
  assistDraftTitle: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  assistDraftSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: palette.textSecondary,
  },
  assistDraftInput: {
    minHeight: 180,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: palette.bgInput,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...typography.bodyLg,
    color: palette.textPrimary,
  },
  assistDraftActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  assistDraftButton: {
    flex: 1,
    height: 50,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  assistDraftGhostButton: {
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  assistDraftPrimaryButton: {
    backgroundColor: palette.accent,
  },
  assistDraftButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.textOnAccent,
  },
  assistDraftGhostButtonText: {
    color: palette.textPrimary,
  },
});

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
        <StartSessionCard
          onStart={handleStartSession}
          dailyMinutesUsed={dailyMinutesUsed}
          dailyMinutesLimit={dailyMinutesLimit}
          isLimitReached={isDailyLimitReached}
          selectedScene={scenePreset}
        />
      )}

      {isActive && (
        <View style={styles.activeContainer}>
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

      <SpeakerCalibration
        visible={showCalibration}
        onComplete={handleCalibrationComplete}
        onSkip={handleCalibrationSkip}
      />

      <DebugOverlay />

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
    backgroundColor: "#F6F7FB",
  },
  activeContainer: {
    flex: 1,
  },
  wsStatusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.06)",
  },
  wsStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    gap: 8,
  },
  wsStatusLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  wsStatusValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  wsStatusHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
  assistWsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  assistWsDot: {
    marginTop: 0,
    marginRight: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  assistWsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  assistWsValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  assistDraftBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.58)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  assistDraftCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
  },
  assistDraftTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  assistDraftSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },
  assistDraftInput: {
    minHeight: 180,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    fontSize: 16,
    lineHeight: 24,
    color: "#111827",
  },
  assistDraftActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  assistDraftButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  assistDraftGhostButton: {
    backgroundColor: "#F3F4F6",
  },
  assistDraftPrimaryButton: {
    backgroundColor: "#111827",
  },
  assistDraftButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  assistDraftGhostButtonText: {
    color: "#111827",
  },
});

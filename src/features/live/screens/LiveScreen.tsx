import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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

import { useConversationStore } from "@/features/live/store/conversationStore";
import { useSessionStore } from "@/features/live/store/sessionStore";

import { ConversationFlow } from "../components/ConversationFlow";
import { ConversationToolbar } from "../components/ConversationToolbar";
import { FloatingSimulateButton } from "../components/FloatingSimulateButton";
import type { PressAndSlideAction } from "../components/PressAndSlideButton";
import { SpeakerCalibration } from "../components/SpeakerCalibration";
import { StartSessionCard } from "../components/StartSessionCard";
import SuggestionPanel from "../components/SuggestionPanel";

import { DebugOverlay } from "../components/DebugOverlay";
import { assistReplyService } from "../services/AssistReplyService";
import { assistStreamingService } from "../services/AssistStreamingService";
import { AudioEngine, audioEngine } from "../services/AudioEngine";
import { deepgramService } from "../services/DeepgramStreamingService";
import { deepgramTokenService } from "../services/DeepgramTokenService";
import { reviewService } from "../services/ReviewService";
import { sessionManager } from "../services/SessionManager";
import type { StreamingConnectionStatus } from "../services/StreamingWebSocketClient";
import { suggestionService } from "../services/SuggestionService";
import { useDebugStore } from "../store/debugStore";
import { useSuggestionStore } from "../store/suggestionStore";

import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";
import { type Href, useRouter } from "expo-router";

function getWsStatusMeta(
  status: StreamingConnectionStatus,
  labelPrefix: string,
) {
  switch (status) {
    case "connecting":
      return { label: `${labelPrefix} connecting`, color: "#FF9500" };
    case "open":
      return { label: `${labelPrefix} live`, color: "#34C759" };
    case "error":
      return { label: `${labelPrefix} error`, color: "#FF3B30" };
    case "closed":
      return { label: `${labelPrefix} closed`, color: "#8E8E93" };
    default:
      return { label: `${labelPrefix} idle`, color: "#8E8E93" };
  }
}

const PAUSED_WS_IDLE_TIMEOUT_MS = 60_000;

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const status = useSessionStore((s) => s.status);
  const scenePreset = useSessionStore((s) => s.scenePreset);
  const sceneDescription = useSessionStore((s) => s.sceneDescription);
  const dailyMinutesUsed = useSessionStore((s) => s.dailyMinutesUsed);
  const dailyMinutesLimit = useSessionStore((s) => s.dailyMinutesLimit);
  const isDailyLimitReached = useSessionStore((s) => s.isDailyLimitReached);
  const startSession = useSessionStore((s) => s.startSession);
  const pauseSession = useSessionStore((s) => s.pauseSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const endSession = useSessionStore((s) => s.endSession);

  const isListening = useConversationStore((s) => s.isListening);
  const mainWsStatus = useConversationStore((s) => s.mainWsStatus);
  const assistWsStatus = useConversationStore((s) => s.assistWsStatus);
  const setListening = useConversationStore((s) => s.setListening);
  const setSelfSpeakerId = useConversationStore((s) => s.setSelfSpeakerId);
  const forcedSpeaker = useConversationStore((s) => s.forcedSpeaker);
  const setForcedSpeaker = useConversationStore((s) => s.setForcedSpeaker);
  const setReleaseForcedOnUtteranceEnd = useConversationStore(
    (s) => s.setReleaseForcedOnUtteranceEnd,
  );

  const [duration, setDuration] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [assistState, setAssistState] = useState<
    "idle" | "recording" | "processing" | "playing" | "editing"
  >("idle");
  const [assistPreviewText, setAssistPreviewText] = useState("");
  const [assistDraftText, setAssistDraftText] = useState("");
  const [isAssistDraftVisible, setIsAssistDraftVisible] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const assistShouldResumeRef = useRef(false);

  useEffect(() => {
    if (status !== "active") return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (assistState !== "recording") {
      setAssistPreviewText("");
      return;
    }

    const syncPreviewText = () => {
      setAssistPreviewText(assistStreamingService.getPreviewTranscript());
    };

    syncPreviewText();
    const interval = setInterval(syncPreviewText, 120);
    return () => clearInterval(interval);
  }, [assistState]);

  const handleUtteranceEnd = useCallback(
    ({
      speaker,
      text,
      turnId,
    }: {
      speaker: "self" | "other";
      text: string;
      turnId: string;
    }): Promise<void> =>
      (async () => {
        const debug = useDebugStore.getState();
        const suggestionStore = useSuggestionStore.getState();
        console.log(
          "[LiveScreen] UtteranceEnd -> speaker=" +
            speaker +
            ", turnId=" +
            turnId,
        );
        if (!sessionIdRef.current || !text.trim()) return;

        const scene = sceneDescription || scenePreset;

        if (speaker === "other") {
          debug.startTurnLlm(turnId, "suggest");
          await suggestionService.fetchSuggestions(
            sessionIdRef.current,
            text,
            scene,
            turnId,
          );
        }

        if (speaker === "self") {
          suggestionStore.clear();
          debug.startTurnLlm(turnId, "review");
          await reviewService.fetchReview(
            sessionIdRef.current,
            text,
            scene,
            turnId,
          );
        }
      })(),
    [scenePreset, sceneDescription],
  );

  const sendAudioRef = useRef((base64: string) => {
    deepgramService.sendAudio(base64);
  });

  const connectStreamingSocket = useCallback(async () => {
    const debug = useDebugStore.getState();

    debug.startStep("token", "🔑 Getting Deepgram token...");
    console.log("[LiveScreen] Getting Deepgram token...");
    const token = await deepgramTokenService.getToken();
    debug.completeStep("token");

    debug.startStep("ws", "🔌 Connecting WebSocket...");
    console.log("[LiveScreen] Connecting Deepgram...");
    await deepgramService.connect(token, handleUtteranceEnd);
    debug.completeStep("ws");
  }, [handleUtteranceEnd, isDailyLimitReached, router]);

  const startAudioCapture = useCallback(async () => {
    const debug = useDebugStore.getState();

    debug.startStep("record", "🎙 Starting recording...");
    console.log("[LiveScreen] Starting audio engine...");
    await audioEngine.start(sendAudioRef.current);
    debug.completeStep("record");
    setListening(true);
  }, [setListening]);

  const startStreaming = useCallback(
    async (speakerId: number | null) => {
      const debug = useDebugStore.getState();
      console.log("[LiveScreen] Starting streaming...");
      try {
        setSelfSpeakerId(speakerId);
        setShowCalibration(false);

        debug.startStep("session", "📋 Creating session...");
        const sessionId = await sessionManager.createSession({
          scenePreset,
          sceneDescription,
        });
        debug.completeStep("session", sessionId);
        console.log("[LiveScreen] Session created:", sessionId);
        sessionIdRef.current = sessionId;
        await connectStreamingSocket();
        startSession(sessionId);
        await startAudioCapture();
        console.log("[LiveScreen] Streaming started");
      } catch (error) {
        const debug = useDebugStore.getState();
        const runningStep = debug.steps.find((s) => s.status === "running");
        if (runningStep) {
          debug.failStep(
            runningStep.id,
            error instanceof Error ? error.message : String(error),
          );
        }
        deepgramService.disconnect();
        await audioEngine.stop();
        setListening(false);
        console.error("[LiveScreen] Failed to start streaming:", error);
      }
    },
    [
      connectStreamingSocket,
      sceneDescription,
      scenePreset,
      startAudioCapture,
      startSession,
      setSelfSpeakerId,
      setListening,
    ],
  );

  const handleStartSession = useCallback(async () => {
    if (isDailyLimitReached) {
      Alert.alert(
        "Upgrade required",
        "Today's free minutes are used up. Upgrade to Pro to keep practicing.",
        [
          { text: "Later", style: "cancel" },
          {
            text: "View plans",
            onPress: () => {
              router.push("/paywall" as Href);
            },
          },
        ],
      );
      return;
    }

    const debug = useDebugStore.getState();
    debug.reset();
    debug.startStep("mic", "🎤 Requesting mic permission...");
    console.log("[LiveScreen] Requesting mic permission...");
    const granted = await AudioEngine.requestPermission();
    if (!granted) {
      debug.failStep("mic", "Permission denied");
      console.error("[LiveScreen] Mic permission denied");
      return;
    }
    debug.completeStep("mic", "granted");
    console.log("[LiveScreen] Mic permission granted");

    debug.startStep("audio-init", "🔧 Initializing audio engine...");
    await audioEngine.init();
    debug.completeStep("audio-init");
    deepgramTokenService.prewarm();

    setShowCalibration(true);
  }, []);

  const handleCalibrationComplete = useCallback(
    (speakerId: number) => {
      console.log(
        "[LiveScreen] Calibration complete, selfSpeakerId:",
        speakerId,
      );
      startStreaming(speakerId);
    },
    [startStreaming],
  );

  const handleCalibrationSkip = useCallback(() => {
    startStreaming(null);
  }, [startStreaming]);

  const handlePause = useCallback(async () => {
    await audioEngine.stop();
    deepgramService.beginPausedRetention();
    pauseSession();
    setListening(false);
    console.log("[LiveScreen] Session paused");
  }, [pauseSession, setListening]);

  const handleResume = useCallback(async () => {
    if (mainWsStatus === "connecting") {
      return;
    }

    console.log("[LiveScreen] Resuming session...");
    resumeSession();
    setListening(false);

    try {
      if (deepgramService.canResumeWithoutReconnect()) {
        deepgramService.cancelPausedRetention();
      } else {
        await connectStreamingSocket();
      }
      await startAudioCapture();
      console.log("[LiveScreen] Session resumed");
    } catch (error) {
      pauseSession();
      setListening(false);
      console.error("[LiveScreen] Failed to resume streaming:", error);
    }
  }, [
    connectStreamingSocket,
    pauseSession,
    resumeSession,
    setListening,
    startAudioCapture,
    mainWsStatus,
  ]);

  const handleSimulateOtherPressIn = useCallback(() => {
    setForcedSpeaker("other");
    setReleaseForcedOnUtteranceEnd(false);
    console.log("[LiveScreen] Simulating other speaker");
  }, [setForcedSpeaker, setReleaseForcedOnUtteranceEnd]);

  const handleSimulateOtherPressOut = useCallback(
    async (isCancelled: boolean) => {
      if (isCancelled) {
        deepgramService.cancelHeldForcedTurn();
        console.log("[LiveScreen] Simulated other speaker cancelled");
        return;
      }
      await deepgramService.flushHeldForcedTurn();
      console.log(
        "[LiveScreen] Will clear simulated other after current utterance",
      );
    },
    [setForcedSpeaker, setReleaseForcedOnUtteranceEnd],
  );

  const restoreMainConversationCapture = useCallback(async () => {
    if (!assistShouldResumeRef.current) {
      return;
    }

    assistShouldResumeRef.current = false;

    if (deepgramService.canResumeWithoutReconnect()) {
      deepgramService.cancelPausedRetention();
    } else {
      await connectStreamingSocket();
    }
    await startAudioCapture();
  }, [connectStreamingSocket, startAudioCapture]);

  const processAssistTranscript = useCallback(
    async (rawTranscript: string) => {
      const transcript = rawTranscript.trim();
      if (!transcript) {
        setAssistState("idle");
        setAssistDraftText("");
        setIsAssistDraftVisible(false);
        try {
          await restoreMainConversationCapture();
        } catch (restoreError) {
          console.error(
            "[NativeAssist] Failed to restore live audio after empty draft:",
            restoreError,
          );
        }
        Alert.alert("Notice", "No clear speech detected. Please try again.");
        return;
      }

      const debug = useDebugStore.getState();
      setAssistState("processing");
      setIsAssistDraftVisible(false);
      setAssistDraftText(transcript);

      const placeholderTurnId = `assist-${Date.now()}`;
      useConversationStore.getState().addTurn({
        id: placeholderTurnId,
        turnId: placeholderTurnId,
        speaker: "self",
        text: "Translating and generating reply...",
        isFinal: false,
        timestamp: Date.now(),
        isAssist: true,
        assistSourceText: transcript,
      });

      try {
        debug.startStep("assist-translate", "🌐 翻译并生成英文回复...");
        const result = await assistReplyService.translateTranscript(
          transcript,
          sceneDescription || scenePreset,
        );
        debug.completeStep("assist-translate", "done");

        if (result.englishReply) {
          useConversationStore.getState().updateTurn(placeholderTurnId, {
            text: result.englishReply,
            isFinal: true,
            assistSourceText: result.sourceText,
          });
        } else {
          useConversationStore.getState().removeTurn(placeholderTurnId);
        }

        setAssistState("playing");
        debug.startStep("assist-tts", "🔊 播放 TTS...");
        await assistReplyService.playReply(result);
        debug.completeStep("assist-tts", "done");
      } catch (error) {
        useConversationStore.getState().removeTurn(placeholderTurnId);
        if (debug.steps.some((step) => step.id === "assist-translate")) {
          debug.failStep(
            "assist-translate",
            error instanceof Error ? error.message : String(error),
          );
        }
        debug.failStep("assist-tts", "Skipped due to error");
        console.error("[NativeAssist] Failed to translate/play:", error);
        Alert.alert(
          "Notice",
          error instanceof Error
            ? error.message
            : "Failed to generate English reply. Please try again.",
        );
      } finally {
        setAssistState("idle");
        setAssistPreviewText("");
        setAssistDraftText("");
        try {
          await restoreMainConversationCapture();
        } catch (restoreError) {
          console.error(
            "[NativeAssist] Failed to restore live audio:",
            restoreError,
          );
        }
      }
    },
    [restoreMainConversationCapture, sceneDescription, scenePreset],
  );

  const dismissAssistDraft = useCallback(async () => {
    setIsAssistDraftVisible(false);
    setAssistDraftText("");
    setAssistPreviewText("");
    setAssistState("idle");
    try {
      await restoreMainConversationCapture();
    } catch (restoreError) {
      console.error(
        "[NativeAssist] Failed to restore live audio after closing draft:",
        restoreError,
      );
    }
  }, [restoreMainConversationCapture]);

  const submitAssistDraft = useCallback(async () => {
    await processAssistTranscript(assistDraftText);
  }, [assistDraftText, processAssistTranscript]);

  const handleNativeAssistPressIn = useCallback(async () => {
    if (assistState !== "idle") {
      return;
    }

    const debug = useDebugStore.getState();

    try {
      assistShouldResumeRef.current = isListening;

      if (isListening) {
        await audioEngine.stop();
        deepgramService.beginPausedRetention(PAUSED_WS_IDLE_TIMEOUT_MS);
        setListening(false);
      }

      await assistReplyService.stopPlayback();
      debug.startStep("assist-ws", "🧠 母语 WS 建连/复用...");

      if (assistStreamingService.canResumeWithoutReconnect()) {
        assistStreamingService.cancelPausedRetention();
        debug.completeStep("assist-ws", "reused");
      } else {
        const token = await deepgramTokenService.getToken();
        await assistStreamingService.connect(token);
        debug.completeStep("assist-ws", "connected");
      }

      assistStreamingService.startCapture();
      setAssistPreviewText("");
      debug.startStep("assist-transcript", "📝 等待母语 transcript...");
      await audioEngine.start((base64: string) => {
        assistStreamingService.sendAudio(base64);
      });
      setAssistState("recording");
    } catch (error) {
      if (debug.steps.some((step) => step.id === "assist-ws")) {
        debug.failStep(
          "assist-ws",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (debug.steps.some((step) => step.id === "assist-transcript")) {
        debug.failStep(
          "assist-transcript",
          error instanceof Error ? error.message : String(error),
        );
      }
      assistStreamingService.cancelCapture();
      if (assistShouldResumeRef.current) {
        try {
          await restoreMainConversationCapture();
        } catch (restoreError) {
          console.error(
            "[NativeAssist] Failed to restore live audio after setup error:",
            restoreError,
          );
        }
      }
      assistShouldResumeRef.current = false;
      setAssistPreviewText("");
      setAssistState("idle");
      console.error("[NativeAssist] Failed to prepare assist:", error);
    }
  }, [assistState, isListening, restoreMainConversationCapture, setListening]);

  const handleNativeAssistPressOut = useCallback(
    async (action: PressAndSlideAction) => {
      if (assistState !== "recording") {
        return;
      }

      const debug = useDebugStore.getState();

      if (action === "cancel") {
        await audioEngine.stop();
        assistStreamingService.cancelCapture();
        setAssistPreviewText("");
        setAssistState("idle");
        debug.completeStep("assist-transcript", "cancelled");
        try {
          await restoreMainConversationCapture();
        } catch (e) {
          console.error("[NativeAssist] Failed to cancel capture:", e);
        }
        return;
      }

      await audioEngine.stop();

      const { transcript } = await assistStreamingService.finishCapture();
      assistStreamingService.beginPausedRetention(PAUSED_WS_IDLE_TIMEOUT_MS);
      setAssistPreviewText("");
      debug.completeStep(
        "assist-transcript",
        transcript ? "done" : "empty transcript",
      );
      if (!transcript) {
        setAssistState("idle");
        try {
          await restoreMainConversationCapture();
        } catch (restoreError) {
          console.error(
            "[NativeAssist] Failed to restore live audio after empty transcript:",
            restoreError,
          );
        }
        Alert.alert("Notice", "No clear speech detected. Please try again.");
        return;
      }

      if (action === "text") {
        setAssistDraftText(transcript);
        setIsAssistDraftVisible(true);
        setAssistState("editing");
        return;
      }

      await processAssistTranscript(transcript);
    },
    [assistState, processAssistTranscript, restoreMainConversationCapture],
  );

  const handleEnd = useCallback(async () => {
    console.log("[LiveScreen] Ending session...");
    const currentSessionId = sessionIdRef.current;

    await audioEngine.stop();
    deepgramService.disconnect();
    assistStreamingService.disconnect();
    endSession();
    setListening(false);

    if (currentSessionId) {
      try {
        await sessionManager.endSession({
          sessionId: currentSessionId,
          durationSeconds: duration,
        });
      } catch (error) {
        console.error("[SessionManager] Failed to end session:", error);
      }
    }

    setDuration(0);
    sessionIdRef.current = null;
    setForcedSpeaker(null);
    console.log("[LiveScreen] Session ended");
    useDebugStore.getState().reset();
  }, [duration, endSession, setForcedSpeaker, setListening]);

  const isIdle = status === "idle" || status === "ended";
  const isActive =
    status === "active" || status === "paused" || status === "calibrating";
  const mainWsMeta = getWsStatusMeta(mainWsStatus, "Deepgram");
  const assistWsMeta = getWsStatusMeta(assistWsStatus, "Assist WS");
  const shouldShowAssistWs =
    assistState !== "idle" || assistWsStatus !== "idle";
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

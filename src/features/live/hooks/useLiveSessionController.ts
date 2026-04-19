import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import type { PressAndSlideAction } from "@/features/live/components/PressAndSlideButton";
import { useAccessStore } from "@/features/live/store/accessStore";
import { useConversationStore } from "@/features/live/store/conversationStore";
import { useSessionStore } from "@/features/live/store/sessionStore";
import { assistReplyService } from "@/features/live/services/AssistReplyService";
import { assistStreamingService } from "@/features/live/services/AssistStreamingService";
import { AudioEngine, audioEngine } from "@/features/live/services/AudioEngine";
import { deepgramService } from "@/features/live/services/DeepgramStreamingService";
import { deepgramTokenService } from "@/features/live/services/DeepgramTokenService";
import { reviewService } from "@/features/live/services/ReviewService";
import { sessionManager } from "@/features/live/services/SessionManager";
import type { StreamingConnectionStatus } from "@/features/live/services/StreamingWebSocketClient";
import { useReviewStore } from "@/features/live/store/reviewStore";
import { suggestionService } from "@/features/live/services/SuggestionService";
import { translationService } from "@/features/live/services/TranslationService";
import { useDebugStore } from "@/features/live/store/debugStore";
import { useSuggestionStore } from "@/features/live/store/suggestionStore";
import {
  isFeatureAccessError,
  shouldRedirectToLogin,
  shouldRedirectToPaywall,
} from "@/shared/billing/access";
import { type Href, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";

const PAUSED_WS_IDLE_TIMEOUT_MS = 60_000;
const LIVE_PAGE_PRECONNECT_IDLE_TIMEOUT_MS = 45_000;

export function getWsStatusMeta(
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

function isEnglishTag(tag: string | undefined): boolean {
  if (!tag) return false;
  return tag.toLowerCase().startsWith("en");
}

export type AssistUiState =
  | "idle"
  | "recording"
  | "processing"
  | "playing"
  | "editing";

export function useLiveSessionController() {
  const router = useRouter();
  const isFocused = useIsFocused();

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

  const [duration, setDuration] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [assistState, setAssistState] = useState<AssistUiState>("idle");
  const [assistPreviewText, setAssistPreviewText] = useState("");
  const [assistDraftText, setAssistDraftText] = useState("");
  const [isAssistDraftVisible, setIsAssistDraftVisible] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const assistShouldResumeRef = useRef(false);

  const sendAudioRef = useRef((base64: string) => {
    deepgramService.sendAudio(base64);
  });

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

  const handleFeatureAccessDenied = useCallback(
    (error: unknown) => {
      if (!isFeatureAccessError(error)) {
        return false;
      }

      if (shouldRedirectToLogin(error.access)) {
        router.push("/login");
        return true;
      }

      if (shouldRedirectToPaywall(error.access)) {
        router.push("/paywall" as Href);
        return true;
      }

      return false;
    },
    [router],
  );

  const handleUtteranceEnd = useCallback(
    ({
      speaker,
      text,
      turnId,
      detectedLanguage,
    }: {
      speaker: "self" | "other";
      text: string;
      turnId: string;
      detectedLanguage?: string;
    }): Promise<void> =>
      (async () => {
        const debug = useDebugStore.getState();
        const suggestionStore = useSuggestionStore.getState();
        const trimmed = text.trim();
        console.log(
          "[LiveSession] UtteranceEnd -> speaker=" +
            speaker +
            ", lang=" +
            (detectedLanguage ?? "?") +
            ", turnId=" +
            turnId,
        );
        if (!sessionIdRef.current || !trimmed) return;

        const scene = sceneDescription || scenePreset;
        const isEnglish = isEnglishTag(detectedLanguage);

        if (speaker === "other") {
          // Learning layer: suggest English replies for the user to choose/say.
          debug.startTurnLlm(turnId, "suggest");
          try {
            await suggestionService.fetchSuggestions(
              sessionIdRef.current,
              trimmed,
              scene,
              turnId,
            );
          } catch (error) {
            handleFeatureAccessDenied(error);
          }

          // Translation layer: if the other party spoke English, translate to user's native tongue.
          if (isEnglish) {
            void translationService.translate({
              turnId,
              text: trimmed,
              direction: "to_native",
              sceneHint: scene,
            });
          }
          return;
        }

        // speaker === 'self'
        suggestionStore.clear();

        if (isEnglish) {
          // Learning layer: grade the user's English.
          debug.startTurnLlm(turnId, "review");
          try {
            await reviewService.fetchReview(
              sessionIdRef.current,
              trimmed,
              scene,
              turnId,
            );
          } catch (error) {
            handleFeatureAccessDenied(error);
          }
          return;
        }

        // Self spoke their native language -> translate into English so it can be shown / read aloud to the other party.
        void translationService.translate({
          turnId,
          text: trimmed,
          direction: "to_en",
          sceneHint: scene,
        });
      })(),
    [handleFeatureAccessDenied, scenePreset, sceneDescription],
  );

  const preconnectMainSocket = useCallback(async () => {
    if (
      !isFocused ||
      status === "active" ||
      status === "paused" ||
      status === "calibrating"
    ) {
      return;
    }

    const debug = useDebugStore.getState();
    const currentMainWsStatus = useConversationStore.getState().mainWsStatus;

    try {
      if (deepgramService.canResumeWithoutReconnect()) {
        debug.startStep("prewarm-ws", "Prewarming Live WebSocket...");
        deepgramService.beginPausedRetention(
          LIVE_PAGE_PRECONNECT_IDLE_TIMEOUT_MS,
        );
        debug.completeStep("prewarm-ws", "reused");
        return;
      }

      if (currentMainWsStatus === "connecting") {
        return;
      }

      debug.startStep("prewarm-token", "Prewarming Deepgram token...");
      const token = await deepgramTokenService.getToken();
      debug.completeStep("prewarm-token", "ready");
      debug.startStep("prewarm-ws", "Prewarming Live WebSocket...");
      await deepgramService.connect(token, handleUtteranceEnd);
      deepgramService.beginPausedRetention(LIVE_PAGE_PRECONNECT_IDLE_TIMEOUT_MS);
      debug.completeStep("prewarm-ws", "connected");
    } catch (error) {
      if (
        useDebugStore.getState().steps.some(
          (step) => step.id === "prewarm-token" && step.status === "running",
        )
      ) {
        debug.failStep(
          "prewarm-token",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (
        useDebugStore.getState().steps.some(
          (step) => step.id === "prewarm-ws" && step.status === "running",
        )
      ) {
        debug.failStep(
          "prewarm-ws",
          error instanceof Error ? error.message : String(error),
        );
      }
      console.warn("[LiveSession] Main WS preconnect failed:", error);
    }
  }, [handleUtteranceEnd, isFocused, status]);

  const disconnectIdleSockets = useCallback(() => {
    if (
      status === "active" ||
      status === "paused" ||
      status === "calibrating"
    ) {
      return;
    }

    const currentConversationState = useConversationStore.getState();

    if (
      deepgramService.canResumeWithoutReconnect() ||
      currentConversationState.mainWsStatus === "connecting"
    ) {
      deepgramService.disconnect();
    }

    if (
      assistStreamingService.canResumeWithoutReconnect() ||
      currentConversationState.assistWsStatus === "connecting"
    ) {
      assistStreamingService.disconnect();
    }
  }, [status]);

  useEffect(() => {
    if (!isFocused) {
      disconnectIdleSockets();
      return;
    }

    if (status === "idle" || status === "ended") {
      void preconnectMainSocket();
    }
  }, [disconnectIdleSockets, isFocused, preconnectMainSocket, status]);

  const connectStreamingSocket = useCallback(async () => {
    const debug = useDebugStore.getState();

    debug.startStep("token", "Getting Deepgram token...");
    console.log("[LiveSession] Getting Deepgram token...");
    const token = await deepgramTokenService.getToken();
    debug.completeStep("token");

    debug.startStep("ws", "Connecting WebSocket...");
    console.log("[LiveSession] Connecting Deepgram...");
    await deepgramService.connect(token, handleUtteranceEnd);
    debug.completeStep("ws");
  }, [handleUtteranceEnd]);

  const startAudioCapture = useCallback(async () => {
    const debug = useDebugStore.getState();

    debug.startStep("record", "Starting recording...");
    console.log("[LiveSession] Starting audio engine...");
    await audioEngine.start(sendAudioRef.current);
    debug.completeStep("record");
    setListening(true);
  }, [setListening]);

  const startStreaming = useCallback(
    async (speakerId: number | null) => {
      const debug = useDebugStore.getState();
      console.log("[LiveSession] Starting streaming...");
      try {
        setSelfSpeakerId(speakerId);
        setShowCalibration(false);

        debug.startStep("session", "Creating session...");
        const sessionId = await sessionManager.createSession({
          scenePreset,
          sceneDescription,
        });
        debug.completeStep("session", sessionId);
        console.log("[LiveSession] Session created:", sessionId);
        sessionIdRef.current = sessionId;
        if (deepgramService.canResumeWithoutReconnect()) {
          deepgramService.cancelPausedRetention();
        } else {
          await connectStreamingSocket();
        }
        startSession(sessionId);
        await startAudioCapture();
        console.log("[LiveSession] Streaming started");
      } catch (error) {
        const debugState = useDebugStore.getState();
        const runningStep = debugState.steps.find((s) => s.status === "running");
        if (runningStep) {
          debugState.failStep(
            runningStep.id,
            error instanceof Error ? error.message : String(error),
          );
        }
        deepgramService.disconnect();
        await audioEngine.stop();
        setListening(false);
        handleFeatureAccessDenied(error);
        console.error("[LiveSession] Failed to start streaming:", error);
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
      handleFeatureAccessDenied,
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
    useConversationStore.getState().reset();
    useSuggestionStore.getState().clear();
    useReviewStore.getState().clear();
    useAccessStore.getState().clear();
    debug.reset();
    sessionIdRef.current = null;
    assistShouldResumeRef.current = false;
    setDuration(0);
    setForcedSpeaker(null);
    setShowCalibration(false);
    setAssistState("idle");
    setAssistPreviewText("");
    setAssistDraftText("");
    setIsAssistDraftVisible(false);
    debug.startStep("mic", "Requesting mic permission...");
    console.log("[LiveSession] Requesting mic permission...");
    const granted = await AudioEngine.requestPermission();
    if (!granted) {
      debug.failStep("mic", "Permission denied");
      console.error("[LiveSession] Mic permission denied");
      return;
    }
    debug.completeStep("mic", "granted");
    console.log("[LiveSession] Mic permission granted");

    debug.startStep("audio-init", "Initializing audio engine...");
    await audioEngine.init();
    debug.completeStep("audio-init");
    deepgramTokenService.prewarm();

    setShowCalibration(true);
  }, [isDailyLimitReached, router, setForcedSpeaker]);

  const handleCalibrationComplete = useCallback(() => {
    console.log("[LiveSession] Voice detection acknowledged, auto-lock enabled");
    startStreaming(null);
  }, [startStreaming]);

  const handleCalibrationSkip = useCallback(() => {
    startStreaming(null);
  }, [startStreaming]);

  const handlePause = useCallback(async () => {
    await audioEngine.stop();
    deepgramService.beginPausedRetention();
    pauseSession();
    setListening(false);
    console.log("[LiveSession] Session paused");
  }, [pauseSession, setListening]);

  const handleResume = useCallback(async () => {
    if (mainWsStatus === "connecting") {
      return;
    }

    console.log("[LiveSession] Resuming session...");
    resumeSession();
    setListening(false);

    try {
      if (deepgramService.canResumeWithoutReconnect()) {
        deepgramService.cancelPausedRetention();
      } else {
        await connectStreamingSocket();
      }
      await startAudioCapture();
      console.log("[LiveSession] Session resumed");
    } catch (error) {
      pauseSession();
      setListening(false);
      handleFeatureAccessDenied(error);
      console.error("[LiveSession] Failed to resume streaming:", error);
    }
  }, [
    connectStreamingSocket,
    handleFeatureAccessDenied,
    pauseSession,
    resumeSession,
    setListening,
    startAudioCapture,
    mainWsStatus,
  ]);

  const handleSimulateOtherPressIn = useCallback(() => {
    setForcedSpeaker("other");
    console.log("[LiveSession] Simulating other speaker");
  }, [setForcedSpeaker]);

  const handleSimulateOtherPressOut = useCallback(() => {
    setForcedSpeaker(null);
    console.log("[LiveSession] Released simulated other speaker");
  }, [setForcedSpeaker]);

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
        debug.startStep("assist-translate", "Generating English reply...");
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
        debug.startStep("assist-tts", "Playing English reply...");
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
        if (debug.steps.some((step) => step.id === "assist-tts")) {
          debug.failStep("assist-tts", "Skipped due to error");
        }
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
      debug.startStep("assist-ws", "Connecting native-language WebSocket...");

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
      debug.startStep("assist-transcript", "Listening for native transcript...");
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
      handleFeatureAccessDenied(error);
      console.error("[NativeAssist] Failed to prepare assist:", error);
    }
  }, [
    assistState,
    handleFeatureAccessDenied,
    isListening,
    restoreMainConversationCapture,
    setListening,
  ]);

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
    console.log("[LiveSession] Ending session...");
    const currentSessionId = sessionIdRef.current;

    await audioEngine.stop();
    deepgramService.disconnect();
    assistStreamingService.disconnect();
    await translationService.stopPlayback();
    endSession();
    useConversationStore.getState().reset();
    useSuggestionStore.getState().clear();
    useReviewStore.getState().clear();

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
    assistShouldResumeRef.current = false;
    setForcedSpeaker(null);
    setShowCalibration(false);
    setAssistState("idle");
    setAssistPreviewText("");
    setAssistDraftText("");
    setIsAssistDraftVisible(false);
    useAccessStore.getState().clear();
    console.log("[LiveSession] Session ended");
    useDebugStore.getState().reset();
    if (isFocused) {
      void preconnectMainSocket();
    }
  }, [duration, endSession, isFocused, preconnectMainSocket, setForcedSpeaker]);

  const isIdle = status === "idle" || status === "ended";
  const isActive =
    status === "active" || status === "paused" || status === "calibrating";
  const mainWsMeta = getWsStatusMeta(mainWsStatus, "Deepgram");
  const assistWsMeta = getWsStatusMeta(assistWsStatus, "Assist WS");
  const shouldShowAssistWs =
    assistState !== "idle" || assistWsStatus !== "idle";

  return {
    scenePreset,
    sceneDescription,
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
  };
}

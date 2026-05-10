import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { maybeOpenLiveSessionFeedback } from "@/features/feedback/feedbackPromptService";
import { historyService } from "@/features/history/services/historyService";
import type { PressAndSlideAction } from "@/features/live/components/PressAndSlideButton";
import { assistReplyService } from "@/features/live/services/AssistReplyService";
import { assistStreamingService } from "@/features/live/services/AssistStreamingService";
import { AudioEngine, audioEngine } from "@/features/live/services/AudioEngine";
import { AudioLevelMeter } from "@/features/live/services/AudioLevelMeter";
import { deepgramService } from "@/features/live/services/DeepgramStreamingService";
import { deepgramTokenService } from "@/features/live/services/DeepgramTokenService";
import { liveActivityService } from "@/features/live/services/LiveActivityService";
import { reviewService } from "@/features/live/services/ReviewService";
import { sessionManager } from "@/features/live/services/SessionManager";
import type { StreamingConnectionStatus } from "@/features/live/services/StreamingWebSocketClient";
import { suggestionService } from "@/features/live/services/SuggestionService";
import { translationService } from "@/features/live/services/TranslationService";
import { voiceEnrollmentService } from "@/features/live/services/VoiceEnrollmentService";
import { voiceprintService } from "@/features/live/services/VoiceprintService";
import { useAccessStore } from "@/features/live/store/accessStore";
import { useAudioInputStore } from "@/features/live/store/audioInputStore";
import { useConversationStore } from "@/features/live/store/conversationStore";
import { useDebugStore } from "@/features/live/store/debugStore";
import { useReviewStore } from "@/features/live/store/reviewStore";
import { useSessionStore } from "@/features/live/store/sessionStore";
import { useSuggestionStore } from "@/features/live/store/suggestionStore";
import { useAlert } from "@/shared/components";
import { analytics } from "@/shared/analytics/analytics";
import {
  isFeatureAccessError,
  shouldRedirectToLogin,
  shouldRedirectToPaywall,
} from "@/shared/billing/access";
import { languageMatchesTag } from "@/shared/locale/deviceLanguage";
import { useAuthStore } from "@/shared/store/authStore";
import { useLocaleStore } from "@/shared/store/localeStore";
import { useIsFocused } from "@react-navigation/native";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

const PAUSED_WS_IDLE_TIMEOUT_MS = 60_000;
const LIVE_PAGE_PRECONNECT_IDLE_TIMEOUT_MS = 45_000;
const SESSION_HEARTBEAT_INTERVAL_MS = 60_000;
const MAIN_AUDIO_STALE_TIMEOUT_MS = 6_500;
const MAIN_AUDIO_WATCHDOG_INTERVAL_MS = 3_000;
const MAIN_AUDIO_RESTART_COOLDOWN_MS = 15_000;
const SESSION_TIMEOUT_WARNING_SECONDS = 180;
const LIVE_TIMEOUT_PAYWALL_SOURCE = "live_session_timeout";

function hasPaidAccess(subscriptionTier: "free" | "pro" | "unlimited") {
  return subscriptionTier === "pro" || subscriptionTier === "unlimited";
}

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

export type AssistUiState =
  | "idle"
  | "recording"
  | "processing"
  | "playing"
  | "editing";

export type StartSessionUiState =
  | "idle"
  | "preparing"
  | "connecting"
  | "finalizing";

export type CopilotToastState = "enabled" | "disabled" | null;

const START_SESSION_CANCELLED = "start_session_cancelled";

function createStartSessionCancelledError() {
  return new Error(START_SESSION_CANCELLED);
}

function isStartSessionCancelledError(error: unknown) {
  return error instanceof Error && error.message === START_SESSION_CANCELLED;
}

export function useLiveSessionController() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { showAlert } = useAlert();

  const status = useSessionStore((s) => s.status);
  const scenePreset = useSessionStore((s) => s.scenePreset);
  const sceneDescription = useSessionStore((s) => s.sceneDescription);
  const dailyMinutesUsed = useSessionStore((s) => s.dailyMinutesUsed);
  const dailyMinutesLimit = useSessionStore((s) => s.dailyMinutesLimit);
  const isDailyLimitReached = useSessionStore((s) => s.isDailyLimitReached);
  const isSessionStarting = useSessionStore((s) => s.isStarting);
  const copilotEnabled = useSessionStore((s) => s.copilotEnabled);
  const startSession = useSessionStore((s) => s.startSession);
  const pauseSession = useSessionStore((s) => s.pauseSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const endSession = useSessionStore((s) => s.endSession);
  const setSessionStarting = useSessionStore((s) => s.setStarting);
  const setCopilotEnabled = useSessionStore((s) => s.setCopilotEnabled);
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);

  const isListening = useConversationStore((s) => s.isListening);
  const mainWsStatus = useConversationStore((s) => s.mainWsStatus);
  const assistWsStatus = useConversationStore((s) => s.assistWsStatus);
  const setListening = useConversationStore((s) => s.setListening);
  const forcedSpeaker = useConversationStore((s) => s.forcedSpeaker);
  const setForcedSpeaker = useConversationStore((s) => s.setForcedSpeaker);
  const nativeLanguage = useLocaleStore((s) => s.uiLocale);
  const learningLanguage = useLocaleStore((s) => s.learningLanguage);

  const [duration, setDuration] = useState(0);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [assistState, setAssistState] = useState<AssistUiState>("idle");
  const [assistPreviewText, setAssistPreviewText] = useState("");
  const [isSendingSuggestion, setIsSendingSuggestion] = useState(false);
  const [startSessionUiState, setStartSessionUiState] =
    useState<StartSessionUiState>("idle");
  const [copilotToastState, setCopilotToastState] =
    useState<CopilotToastState>(null);
  const [sessionRemainingSecondsAtStart, setSessionRemainingSecondsAtStart] =
    useState<number | null>(null);
  const [isResolvingSessionTimeout, setIsResolvingSessionTimeout] =
    useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const assistShouldResumeRef = useRef(false);
  const sessionTimeoutPendingRef = useRef(false);
  const startAttemptRef = useRef(0);
  const cancelledStartAttemptRef = useRef<number | null>(null);
  const copilotToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mainAudioLevelMeterRef = useRef(new AudioLevelMeter());
  const assistAudioLevelMeterRef = useRef(new AudioLevelMeter());
  const lastMainAudioChunkAtRef = useRef(0);
  const lastMainAudioRestartAtRef = useRef(0);
  const isRestartingMainAudioRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const resetMainAudioLevel = useCallback(() => {
    mainAudioLevelMeterRef.current.reset();
    useAudioInputStore.getState().resetMain();
  }, []);

  const resetAssistAudioLevel = useCallback(() => {
    assistAudioLevelMeterRef.current.reset();
    useAudioInputStore.getState().resetAssist();
  }, []);

  const clearSessionTimeoutResolution = useCallback(() => {
    sessionTimeoutPendingRef.current = false;
    setIsResolvingSessionTimeout(false);
  }, []);

  const sendAudioRef = useRef((base64: string) => {
    lastMainAudioChunkAtRef.current = Date.now();
    const level = mainAudioLevelMeterRef.current.ingest(base64);
    useAudioInputStore.getState().setMainLevel(level);
    voiceprintService.ingestChunk(base64);
    deepgramService.sendAudio(base64);
  });

  useEffect(() => {
    liveActivityService.startObserving();
  }, []);

  useEffect(
    () => () => {
      if (copilotToastTimeoutRef.current) {
        clearTimeout(copilotToastTimeoutRef.current);
        copilotToastTimeoutRef.current = null;
      }
    },
    [],
  );

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

  useEffect(() => {
    if (status !== "active" && status !== "paused") {
      return;
    }

    const beat = () => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        return;
      }

      void sessionManager.touchSessionActivity(currentSessionId);
    };

    beat();
    const interval = setInterval(beat, SESSION_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status]);

  const handleFeatureAccessDenied = useCallback(
    (error: unknown) => {
      if (!isFeatureAccessError(error)) {
        return false;
      }

      analytics.capture("feature_access_denied", {
        feature: error.access?.feature ?? null,
        tier: error.access?.tier ?? null,
        remaining: error.access?.remaining ?? null,
        reason: error.access?.reason ?? null,
      });

      if (shouldRedirectToLogin(error.access)) {
        analytics.capture("feature_access_redirect_login", {
          feature: error.access?.feature ?? null,
        });
        router.push("/login");
        return true;
      }

      const shouldOpenPaywall =
        shouldRedirectToPaywall(error.access) ||
        (error.code as string) === "feature_access_denied";

      if (shouldOpenPaywall) {
        if ((error.code as string) !== "feature_access_denied") {
          console.warn("[LiveSession] Redirecting to paywall from legacy access reason");
        }
        analytics.capture("feature_access_redirect_paywall", {
          feature: error.access?.feature ?? null,
        });
        router.push("/paywall" as Href);
        return true;
      }

      return false;
    },
    [router],
  );

  const handleSessionTimeLimitReached = useCallback(async () => {
    if (sessionTimeoutPendingRef.current || !sessionIdRef.current) {
      return;
    }

    sessionTimeoutPendingRef.current = true;
    setIsResolvingSessionTimeout(true);
    assistShouldResumeRef.current = true;
    analytics.capture("live_session_timeout_reached", {
      duration_seconds: duration,
      subscription_tier: subscriptionTier,
    });

    pauseSession();
    setForcedSpeaker(null);
    setAssistPreviewText("");
    setAssistState("idle");
    setListening(false);

    try {
      voiceprintService.stopSessionAnalysis();
      await audioEngine.stop();
    } catch (error) {
      console.warn("[LiveSession] Failed to stop audio after timeout:", error);
    }

    resetMainAudioLevel();
    resetAssistAudioLevel();
    assistStreamingService.cancelCapture();
    assistStreamingService.disconnect();
    deepgramService.beginPausedRetention(PAUSED_WS_IDLE_TIMEOUT_MS);

    try {
      await assistReplyService.stopPlayback();
    } catch (error) {
      console.warn("[LiveSession] Failed to stop assist playback after timeout:", error);
    }

    try {
      await translationService.stopPlayback();
    } catch (error) {
      console.warn("[LiveSession] Failed to stop translation playback after timeout:", error);
    }

    router.push({
      pathname: "/paywall",
      params: { source: LIVE_TIMEOUT_PAYWALL_SOURCE },
    });
  }, [
    duration,
    pauseSession,
    resetAssistAudioLevel,
    resetMainAudioLevel,
    router,
    setForcedSpeaker,
    setListening,
    subscriptionTier,
  ]);

  const handleUtteranceEnd = useCallback(
    ({
      speaker,
      text,
      turnId,
      isTurnEnd,
      detectedLanguage,
      confidence,
    }: {
      speaker: "self" | "other";
      text: string;
      turnId: string;
      isTurnEnd: boolean;
      detectedLanguage?: string;
      confidence?: number;
    }): Promise<void> =>
      (async () => {
        const debug = useDebugStore.getState();
        const suggestionStore = useSuggestionStore.getState();
        const trimmed = text.trim();
        console.log(
          "[LiveSession] UtteranceEnd -> speaker=" +
            speaker +
            ", isTurnEnd=" +
            String(isTurnEnd) +
            ", lang=" +
            (detectedLanguage ?? "?") +
            ", conf=" +
            (confidence?.toFixed(3) ?? "?") +
            ", turnId=" +
            turnId,
        );
        if (!sessionIdRef.current || !trimmed) return;

        const MIN_CONFIDENCE = 0.75;
        const isLowConfidence = confidence != null && confidence < MIN_CONFIDENCE;
        if (isLowConfidence) {
          console.log(
            "[LiveSession] Skipping LLM downstream for low-confidence turn (" +
              confidence.toFixed(3) +
              " < " +
              MIN_CONFIDENCE +
              ")",
          );
        }

        const scene = sceneDescription || scenePreset;
        const isLearningLanguage = languageMatchesTag(
          detectedLanguage,
          learningLanguage,
        );

        if (speaker === "other") {
          if (!copilotEnabled) {
            return;
          }
          if (!isTurnEnd) {
            console.log(
              "[LiveSession] Skipping suggest for non-turn-end commit, turnId=" + turnId,
            );
            return;
          }
          if (!isLowConfidence) {
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
          }
          return;
        }

        // speaker === 'self'
        suggestionStore.clear();

        if (isLearningLanguage) {
          if (!copilotEnabled) {
            return;
          }
          if (!isLowConfidence) {
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
          }
          return;
        }
      })(),
    [
      copilotEnabled,
      handleFeatureAccessDenied,
      learningLanguage,
      scenePreset,
      sceneDescription,
    ],
  );

  const handleFinalTranscriptUpdated = useCallback(
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
    }) => {
      if (speaker !== "other") {
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      if (!languageMatchesTag(detectedLanguage, learningLanguage)) {
        return;
      }

      void translationService.translate({
        turnId,
        text: trimmed,
        direction: "to_native",
        sceneHint: sceneDescription || scenePreset,
      });
    },
    [learningLanguage, sceneDescription, scenePreset],
  );

  const preconnectMainSocket = useCallback(async () => {
    if (
      !isFocused ||
      status === "active" ||
      status === "paused" ||
      status === "calibrating" ||
      isSessionStarting
    ) {
      return;
    }

    const debug = useDebugStore.getState();
    const currentMainWsStatus = useConversationStore.getState().mainWsStatus;

    try {
      if (deepgramService.canResumeWithoutReconnect(learningLanguage)) {
        debug.startStep("prewarm-ws", "Reusing Live WebSocket...");
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

      // getToken() 是异步的，完成后再次检查 session 是否已开始启动
      const storeState = useSessionStore.getState();
      if (storeState.isStarting || storeState.status === "active") {
        debug.failStep("prewarm-token", "session start in progress, aborting");
        return;
      }

      debug.completeStep("prewarm-token", "ready");
      debug.startStep("prewarm-ws", "Connecting Live WebSocket...");
      await deepgramService.connect(
        token,
        handleUtteranceEnd,
        learningLanguage,
        handleFinalTranscriptUpdated,
      );

      // connect() 也是异步的，完成后再次检查，避免 prewarm socket 干扰活跃 session
      const storeStateAfterConnect = useSessionStore.getState();
      if (storeStateAfterConnect.isStarting || storeStateAfterConnect.status === "active") {
        deepgramService.disconnect();
        debug.failStep("prewarm-ws", "session start in progress, disconnecting prewarm");
        return;
      }

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
  }, [handleUtteranceEnd, isFocused, isSessionStarting, learningLanguage, status]);

  const beginStartAttempt = useCallback(() => {
    const nextAttemptId = startAttemptRef.current + 1;
    startAttemptRef.current = nextAttemptId;
    cancelledStartAttemptRef.current = null;
    setSessionStarting(true);
    setStartSessionUiState("preparing");
    return nextAttemptId;
  }, [setSessionStarting]);

  const assertStartAttemptActive = useCallback((attemptId: number) => {
    if (
      cancelledStartAttemptRef.current === attemptId ||
      startAttemptRef.current !== attemptId
    ) {
      throw createStartSessionCancelledError();
    }
  }, []);

  const cleanupAbortedStart = useCallback(async () => {
    voiceprintService.resetSessionState();
    await audioEngine.stop();
    resetMainAudioLevel();
    resetAssistAudioLevel();
    deepgramService.disconnect();
    assistStreamingService.disconnect();
    await translationService.stopPlayback();
    await sessionManager.clearActiveSession();
    sessionIdRef.current = null;
    assistShouldResumeRef.current = false;
    setListening(false);
    setForcedSpeaker(null);
    setShowCalibration(false);
    setAssistState("idle");
    setAssistPreviewText("");
    setDuration(0);
    setSessionRemainingSecondsAtStart(null);
    setSessionStarting(false);
    clearSessionTimeoutResolution();
    endSession();
    useConversationStore.getState().reset();
    useSuggestionStore.getState().clear();
    useReviewStore.getState().clear();
    useAccessStore.getState().clear();
  }, [
    endSession,
    resetAssistAudioLevel,
    resetMainAudioLevel,
    setForcedSpeaker,
    setListening,
    setSessionStarting,
    clearSessionTimeoutResolution,
  ]);

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
      deepgramService.canResumeWithoutReconnect(learningLanguage) ||
      currentConversationState.mainWsStatus === "connecting"
    ) {
      deepgramService.disconnect();
    }

    if (
      assistStreamingService.canResumeWithoutReconnect(nativeLanguage) ||
      currentConversationState.assistWsStatus === "connecting"
    ) {
      assistStreamingService.disconnect();
    }
  }, [learningLanguage, nativeLanguage, status]);

  useEffect(() => {
    if (!isFocused) {
      disconnectIdleSockets();
      return;
    }

    void voiceprintService.hydrateEnrollmentState();

    if (status === "idle" || status === "ended") {
      void audioEngine.prewarm().catch((error) => {
        console.warn("[LiveSession] Audio prewarm failed:", error);
      });
      void voiceEnrollmentService.prewarm().catch((error) => {
        console.warn("[LiveSession] Enrollment prewarm failed:", error);
      });
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
    await deepgramService.connect(
      token,
      handleUtteranceEnd,
      learningLanguage,
      handleFinalTranscriptUpdated,
    );
    debug.completeStep("ws");
  }, [handleUtteranceEnd, learningLanguage]);

  const startAudioCapture = useCallback(async () => {
    const debug = useDebugStore.getState();

    debug.startStep("record", "Starting recording...");
    console.log("[LiveSession] Starting audio engine...");
    resetMainAudioLevel();
    deepgramService.markLiveTranscriptBoundary();
    deepgramService.enableLiveTranscripts();
    voiceprintService.startSessionAnalysis();
    lastMainAudioChunkAtRef.current = Date.now();
    await audioEngine.start(sendAudioRef.current);
    debug.completeStep("record");
    setListening(true);
  }, [resetMainAudioLevel, setListening]);

  const shouldKeepMainMicActive = useCallback(() => {
    return (
      status === "active" &&
      assistState === "idle" &&
      !isSendingSuggestion &&
      sessionIdRef.current !== null
    );
  }, [assistState, isSendingSuggestion, status]);

  const restartMainAudioCapture = useCallback(
    async (reason: string, options: { bypassCooldown?: boolean } = {}) => {
      if (isRestartingMainAudioRef.current || !shouldKeepMainMicActive()) {
        return;
      }

      const now = Date.now();
      if (
        !options.bypassCooldown &&
        lastMainAudioRestartAtRef.current > 0 &&
        now - lastMainAudioRestartAtRef.current < MAIN_AUDIO_RESTART_COOLDOWN_MS
      ) {
        return;
      }

      lastMainAudioRestartAtRef.current = now;
      isRestartingMainAudioRef.current = true;
      const debug = useDebugStore.getState();
      debug.startStep("mic-watchdog", `Restarting microphone (${reason})`);
      console.warn("[LiveSession] Restarting main microphone:", reason);

      try {
        if (deepgramService.canResumeWithoutReconnect(learningLanguage)) {
          deepgramService.cancelPausedRetention();
          deepgramService.disableLiveTranscripts();
        } else {
          await connectStreamingSocket();
        }

        voiceprintService.stopSessionAnalysis();
        try {
          await audioEngine.stop();
        } catch (stopError) {
          console.warn(
            "[LiveSession] Failed to stop stale audio engine before restart:",
            stopError,
          );
        }
        resetMainAudioLevel();
        await startAudioCapture();
        debug.completeStep("mic-watchdog", reason);
      } catch (error) {
        debug.failStep(
          "mic-watchdog",
          error instanceof Error ? error.message : String(error),
        );
        resetMainAudioLevel();
        setListening(false);
        console.error("[LiveSession] Failed to restart main microphone:", error);
      } finally {
        isRestartingMainAudioRef.current = false;
      }
    },
    [
      connectStreamingSocket,
      learningLanguage,
      resetMainAudioLevel,
      setListening,
      shouldKeepMainMicActive,
      startAudioCapture,
    ],
  );

  const handleRestartMainMicrophone = useCallback(async () => {
    await restartMainAudioCapture("manual", { bypassCooldown: true });
  }, [restartMainAudioCapture]);

  const startStreaming = useCallback(
    async (startAttemptId?: number) => {
      const debug = useDebugStore.getState();
      let createdSessionId: string | null = null;
      let sessionCreationPromise: Promise<string> | null = null;
      console.log("[LiveSession] Starting streaming...");
      try {
        setShowCalibration(false);
        await voiceprintService.hydrateEnrollmentState();
        if (startAttemptId != null) {
          assertStartAttemptActive(startAttemptId);
          setStartSessionUiState("connecting");
        }

        if (deepgramService.canResumeWithoutReconnect(learningLanguage)) {
          deepgramService.cancelPausedRetention();
          deepgramService.disableLiveTranscripts();
        } else {
          await connectStreamingSocket();
        }
        if (startAttemptId != null) {
          assertStartAttemptActive(startAttemptId);
        }

        sessionCreationPromise = (async () => {
          debug.startStep("session", "Creating session...");
          const sessionId = await sessionManager.createSession({
            scenePreset,
            sceneDescription,
          });
          createdSessionId = sessionId;
          debug.completeStep("session", sessionId);
          console.log("[LiveSession] Session created:", sessionId);
          return sessionId;
        })();

        deepgramService.disableLiveTranscripts();
        if (startAttemptId != null) {
          setStartSessionUiState("finalizing");
        }
        const sessionId = await sessionCreationPromise;
        if (startAttemptId != null) {
          assertStartAttemptActive(startAttemptId);
        }
        sessionIdRef.current = sessionId;
        clearSessionTimeoutResolution();
        setSessionRemainingSecondsAtStart(
          hasPaidAccess(useAuthStore.getState().subscriptionTier)
            ? null
            : Math.max(
                0,
                (useSessionStore.getState().dailyMinutesLimit -
                  useSessionStore.getState().dailyMinutesUsed) *
                  60,
              ),
        );
        startSession(sessionId);
        await startAudioCapture();
        if (startAttemptId != null) {
          assertStartAttemptActive(startAttemptId);
          setSessionStarting(false);
          setStartSessionUiState("idle");
        }
        console.log("[LiveSession] Streaming started");
      } catch (error) {
        if (isStartSessionCancelledError(error)) {
          setSessionStarting(false);
          setStartSessionUiState("idle");
          await cleanupAbortedStart();
          console.log("[LiveSession] Session start cancelled");
          return;
        }

        const debugState = useDebugStore.getState();
        const runningStep = debugState.steps.find((s) => s.status === "running");
        if (runningStep) {
          debugState.failStep(
            runningStep.id,
            error instanceof Error ? error.message : String(error),
          );
        }
        let settledSessionId: string | null = createdSessionId;
        if (!settledSessionId && sessionCreationPromise) {
          try {
            settledSessionId = await sessionCreationPromise;
          } catch {
            settledSessionId = null;
          }
        }
        if (settledSessionId) {
          try {
            await sessionManager.endSession({
              sessionId: settledSessionId,
              durationSeconds: 0,
            });
          } catch (sessionCleanupError) {
            console.error(
              "[LiveSession] Failed to cleanup partially started session:",
              sessionCleanupError,
            );
          }
        } else {
          await sessionManager.clearActiveSession();
        }
        sessionIdRef.current = null;
        endSession();
        deepgramService.disconnect();
        await audioEngine.stop();
        resetMainAudioLevel();
        resetAssistAudioLevel();
        setListening(false);
        setSessionStarting(false);
        setStartSessionUiState("idle");
        const didHandleAccessDenied = handleFeatureAccessDenied(error);
        if (didHandleAccessDenied) {
          return;
        }
        console.error("[LiveSession] Failed to start streaming:", error);
      }
    },
    [
      connectStreamingSocket,
      sceneDescription,
      scenePreset,
      startAudioCapture,
      startSession,
      endSession,
      setListening,
      handleFeatureAccessDenied,
      assertStartAttemptActive,
      cleanupAbortedStart,
      clearSessionTimeoutResolution,
      resetAssistAudioLevel,
      resetMainAudioLevel,
    ],
  );

  useEffect(() => {
    if (status !== "active") {
      return;
    }

    const checkMainAudioHealth = () => {
      if (!shouldKeepMainMicActive()) {
        return;
      }

      const conversationState = useConversationStore.getState();
      const elapsedSinceChunk = Date.now() - lastMainAudioChunkAtRef.current;
      const isAudioStale =
        lastMainAudioChunkAtRef.current === 0 ||
        elapsedSinceChunk > MAIN_AUDIO_STALE_TIMEOUT_MS;
      const isSocketOpenButCaptureStopped =
        conversationState.mainWsStatus === "open" &&
        !conversationState.isListening;

      if (isAudioStale || isSocketOpenButCaptureStopped) {
        void restartMainAudioCapture(
          isSocketOpenButCaptureStopped ? "capture-stopped" : "audio-stale",
        );
      }
    };

    const interval = setInterval(
      checkMainAudioHealth,
      MAIN_AUDIO_WATCHDOG_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [restartMainAudioCapture, shouldKeepMainMicActive, status]);

  const isPaidSubscriber = hasPaidAccess(subscriptionTier);
  const remainingSecondsUntilTimeout =
    sessionRemainingSecondsAtStart == null
      ? null
      : Math.max(0, sessionRemainingSecondsAtStart - duration);

  useEffect(() => {
    const remainingSeconds = remainingSecondsUntilTimeout;
    if (
      status !== "active" ||
      isPaidSubscriber ||
      remainingSeconds === null ||
      sessionTimeoutPendingRef.current
    ) {
      return;
    }

    if (remainingSeconds <= 0) {
      void handleSessionTimeLimitReached();
    }
  }, [
    handleSessionTimeLimitReached,
    isPaidSubscriber,
    remainingSecondsUntilTimeout,
    status,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState.match(/inactive|background/) &&
        nextState === "active" &&
        shouldKeepMainMicActive()
      ) {
        const elapsedSinceChunk = Date.now() - lastMainAudioChunkAtRef.current;
        if (
          lastMainAudioChunkAtRef.current === 0 ||
          elapsedSinceChunk > MAIN_AUDIO_STALE_TIMEOUT_MS
        ) {
          void restartMainAudioCapture("app-foreground");
        }
      }
    });

    return () => subscription.remove();
  }, [restartMainAudioCapture, shouldKeepMainMicActive]);

  const handleStartSession = useCallback(async () => {
    if (isDailyLimitReached) {
      analytics.capture("live_start_blocked_opened_paywall", {
        reason: "daily_limit",
      });
      router.push("/paywall" as Href);
      return;
    }

    const debug = useDebugStore.getState();
    const startAttemptId = beginStartAttempt();
    analytics.capture("live_start_attempted", {
      attempt_id: startAttemptId,
      scene_preset: scenePreset ?? null,
      has_scene_description: Boolean(sceneDescription?.trim()),
      copilot_enabled: copilotEnabled,
    });

    try {
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
      debug.startStep("mic", "Requesting mic permission...");
      console.log("[LiveSession] Requesting mic permission...");
      const granted = await AudioEngine.requestPermission();
      assertStartAttemptActive(startAttemptId);
      if (!granted) {
        debug.failStep("mic", "Permission denied");
        setSessionStarting(false);
        setStartSessionUiState("idle");
        analytics.capture("live_start_failed", {
          attempt_id: startAttemptId,
          reason: "mic_permission_denied",
        });
        console.error("[LiveSession] Mic permission denied");
        return;
      }
      debug.completeStep("mic", "granted");
      console.log("[LiveSession] Mic permission granted");

      debug.startStep("audio-init", "Initializing audio engine...");
      const audioInitPromise = audioEngine.init();
      const voiceprintHydrationPromise = voiceprintService.hydrateEnrollmentState();
      const enrollmentAvailabilityPromise =
        voiceEnrollmentService.getEnrollmentAvailability();
      await audioInitPromise;
      assertStartAttemptActive(startAttemptId);
      debug.completeStep("audio-init");
      await voiceprintHydrationPromise;
      assertStartAttemptActive(startAttemptId);
      voiceprintService.resetSessionState();
      deepgramTokenService.prewarm();

      // Show enrollment setup if the user hasn't recorded a voice sample yet
      const enrollmentAvailability = await enrollmentAvailabilityPromise;
      assertStartAttemptActive(startAttemptId);
      if (enrollmentAvailability === "missing") {
        setSessionStarting(false);
        setStartSessionUiState("idle");
        setShowEnrollment(true);
        analytics.capture("live_start_requires_enrollment", {
          attempt_id: startAttemptId,
        });
        return;
      }

      void startStreaming(startAttemptId);
    } catch (error) {
      if (isStartSessionCancelledError(error)) {
        setSessionStarting(false);
        setStartSessionUiState("idle");
        await cleanupAbortedStart();
        analytics.capture("live_start_cancelled", {
          attempt_id: startAttemptId,
        });
        console.log("[LiveSession] Session start cancelled before streaming");
        return;
      }

      setSessionStarting(false);
      setStartSessionUiState("idle");
      analytics.captureError("live_start_failed", error, {
        attempt_id: startAttemptId,
      });
      console.error("[LiveSession] Failed before streaming start:", error);
    }
  }, [
    assertStartAttemptActive,
    beginStartAttempt,
    cleanupAbortedStart,
    isDailyLimitReached,
    router,
    setForcedSpeaker,
    setSessionStarting,
    startStreaming,
  ]);

  const handleEnrollmentComplete = useCallback(() => {
    const startAttemptId = beginStartAttempt();
    setShowEnrollment(false);
    setStartSessionUiState("connecting");
    void startStreaming(startAttemptId);
  }, [beginStartAttempt, startStreaming]);

  const handleEnrollmentSkip = useCallback(() => {
    setShowEnrollment(false);
    setShowCalibration(true);
  }, []);

  const handleCalibrationComplete = useCallback(() => {
    const startAttemptId = beginStartAttempt();
    console.log("[LiveSession] Voice detection acknowledged, auto-lock enabled");
    setStartSessionUiState("connecting");
    void startStreaming(startAttemptId);
  }, [beginStartAttempt, startStreaming]);

  const handleCalibrationSkip = useCallback(() => {
    const startAttemptId = beginStartAttempt();
    setStartSessionUiState("connecting");
    void startStreaming(startAttemptId);
  }, [beginStartAttempt, startStreaming]);

  const handleCancelStartSession = useCallback(() => {
    const activeAttemptId = startAttemptRef.current;
    if (startSessionUiState === "idle" || activeAttemptId === 0) {
      return;
    }

    startAttemptRef.current = activeAttemptId + 1;
    cancelledStartAttemptRef.current = activeAttemptId;
    setSessionStarting(false);
    setStartSessionUiState("idle");
    void cleanupAbortedStart();
  }, [cleanupAbortedStart, setSessionStarting, startSessionUiState]);

  const handleSimulateOtherPressIn = useCallback(() => {
    setForcedSpeaker("other");
    console.log("[LiveSession] Simulating other speaker");
  }, [setForcedSpeaker]);

  const handleSimulateOtherPressOut = useCallback(() => {
    setForcedSpeaker(null);
    console.log("[LiveSession] Released simulated other speaker");
  }, [setForcedSpeaker]);

  const handleToggleCopilot = useCallback(() => {
    const nextEnabled = !copilotEnabled;
    setCopilotEnabled(nextEnabled);
    analytics.capture("copilot_toggled", { enabled: nextEnabled });
    void Haptics.impactAsync(
      nextEnabled
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );

    if (!nextEnabled) {
      useSuggestionStore.getState().clear();
      useReviewStore.getState().setLoading(false);
    }

    setCopilotToastState(nextEnabled ? "enabled" : "disabled");
    if (copilotToastTimeoutRef.current) {
      clearTimeout(copilotToastTimeoutRef.current);
    }
    copilotToastTimeoutRef.current = setTimeout(() => {
      setCopilotToastState(null);
      copilotToastTimeoutRef.current = null;
    }, 1400);
  }, [copilotEnabled, setCopilotEnabled]);

  const restoreMainConversationCapture = useCallback(async () => {
    if (
      !assistShouldResumeRef.current ||
      status !== "active" ||
      sessionTimeoutPendingRef.current
    ) {
      return;
    }

    assistShouldResumeRef.current = false;

    if (deepgramService.canResumeWithoutReconnect()) {
      deepgramService.cancelPausedRetention();
      deepgramService.disableLiveTranscripts();
    } else {
      await connectStreamingSocket();
    }
    await startAudioCapture();
  }, [connectStreamingSocket, startAudioCapture, status]);

  const handleSendSuggestion = useCallback(
    async (rawSuggestion: string) => {
      const suggestion = rawSuggestion.trim();
      const sessionId = sessionIdRef.current;

      if (!suggestion || !sessionId || isSendingSuggestion) {
        return;
      }

      const shouldResumeCapture = isListening;
      const turnId = `suggestion-${Date.now()}`;
      let didPersistTurn = false;

      setIsSendingSuggestion(true);
      assistShouldResumeRef.current = shouldResumeCapture;

      try {
        if (shouldResumeCapture) {
          voiceprintService.stopSessionAnalysis();
          await audioEngine.stop();
          resetMainAudioLevel();
          deepgramService.beginPausedRetention(PAUSED_WS_IDLE_TIMEOUT_MS);
          setListening(false);
        }

        await translationService.stopPlayback();

        useConversationStore.getState().addTurn({
          id: turnId,
          turnId,
          speaker: "self",
          text: suggestion,
          isFinal: true,
          timestamp: Date.now(),
          detectedLanguage: learningLanguage,
        });

        await sessionManager.recordTurn({
          sessionId,
          turnId,
          speaker: "self",
          text: suggestion,
        });
        didPersistTurn = true;

        useSuggestionStore.getState().clear();
        await translationService.speakLearning(suggestion);
      } catch (error) {
        if (!didPersistTurn) {
          useConversationStore.getState().removeTurn(turnId);
        }
        console.error("[Suggestion] Failed to send and play suggestion:", error);
        showAlert({
          title: t("live.alerts.sendSuggestionFailedTitle"),
          message:
            error instanceof Error
              ? error.message
              : t("live.alerts.sendSuggestionFailedBody"),
        });
      } finally {
        try {
          await restoreMainConversationCapture();
        } catch (restoreError) {
          console.error(
            "[Suggestion] Failed to restore live audio after playback:",
            restoreError,
          );
        }
        setIsSendingSuggestion(false);
      }
    },
    [
      isListening,
      isSendingSuggestion,
      learningLanguage,
      restoreMainConversationCapture,
      resetMainAudioLevel,
      setListening,
    ],
  );

  const processAssistTranscript = useCallback(
    async (
      rawTranscript: string,
      options?: {
        speakReply?: boolean;
      },
    ) => {
      const transcript = rawTranscript.trim();
      const speakReply = options?.speakReply ?? false;
      if (!transcript) {
        setAssistState("idle");
        try {
          await restoreMainConversationCapture();
        } catch (restoreError) {
          console.error(
            "[NativeAssist] Failed to restore live audio after empty draft:",
            restoreError,
          );
        }
        showAlert({
          title: t("live.alerts.noSpeechTitle"),
          message: t("live.alerts.noSpeechBody"),
        });
        return;
      }

      const debug = useDebugStore.getState();
      setAssistState("processing");

      const placeholderTurnId = `assist-${Date.now()}`;
      useConversationStore.getState().addTurn({
        id: placeholderTurnId,
        turnId: placeholderTurnId,
        speaker: "self",
        text: "Translating to the learning language...",
        isFinal: false,
        timestamp: Date.now(),
        isAssist: true,
        assistSourceText: transcript,
      });

      try {
        debug.startStep("assist-translate", "Translating to learning language...");
        const result = await assistReplyService.translateTranscript(
          transcript,
          sceneDescription || scenePreset,
        );
        debug.completeStep("assist-translate", "done");

        if (result.learningTranslation) {
          useConversationStore.getState().updateTurn(placeholderTurnId, {
            text: result.learningTranslation,
            isFinal: true,
            assistSourceText: result.sourceText,
          });
        } else {
          useConversationStore.getState().removeTurn(placeholderTurnId);
        }

        if (speakReply) {
          setAssistState("playing");
          debug.startStep("assist-tts", "Playing learning-language reply...");
          await assistReplyService.playReply(result);
          debug.completeStep("assist-tts", "done");
        }
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
        showAlert({
          title: t("live.alerts.translateFailedTitle"),
          message:
            error instanceof Error
              ? error.message
              : t("live.alerts.translateFailedBody"),
        });
      } finally {
        setAssistState("idle");
        setAssistPreviewText("");
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

  const handleNativeAssistPressIn = useCallback(async () => {
    if (assistState !== "idle") {
      return;
    }

    const debug = useDebugStore.getState();

    try {
      assistShouldResumeRef.current = isListening;

      if (isListening) {
        voiceprintService.stopSessionAnalysis();
        resetMainAudioLevel();
        deepgramService.beginPausedRetention(PAUSED_WS_IDLE_TIMEOUT_MS);
        setListening(false);
      }

      await assistReplyService.stopPlayback();
      debug.startStep("assist-ws", "Connecting native-language WebSocket...");

      if (assistStreamingService.canResumeWithoutReconnect(nativeLanguage)) {
        assistStreamingService.cancelPausedRetention();
        debug.completeStep("assist-ws", "reused");
      } else {
        const token = await deepgramTokenService.getToken();
        await assistStreamingService.connect(token, nativeLanguage);
        debug.completeStep("assist-ws", "connected");
      }

      assistStreamingService.startCapture();
      resetAssistAudioLevel();
      setAssistPreviewText("");
      debug.startStep("assist-transcript", "Listening for native transcript...");
      const startAssistAudio = isListening
        ? audioEngine.switchInput.bind(audioEngine)
        : audioEngine.start.bind(audioEngine);
      await startAssistAudio((base64: string) => {
        const level = assistAudioLevelMeterRef.current.ingest(base64);
        useAudioInputStore.getState().setAssistLevel(level);
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
      resetAssistAudioLevel();
      setAssistPreviewText("");
      setAssistState("idle");
      handleFeatureAccessDenied(error);
      console.error("[NativeAssist] Failed to prepare assist:", error);
    }
  }, [
    assistState,
    handleFeatureAccessDenied,
    isListening,
    nativeLanguage,
    resetAssistAudioLevel,
    resetMainAudioLevel,
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
        resetAssistAudioLevel();
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
      resetAssistAudioLevel();

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
        showAlert({
          title: t("live.alerts.noSpeechTitle"),
          message: t("live.alerts.noSpeechBody"),
        });
        return;
      }

      await processAssistTranscript(transcript, {
        speakReply: action === "speak",
      });
    },
    [
      assistState,
      processAssistTranscript,
      resetAssistAudioLevel,
      restoreMainConversationCapture,
    ],
  );

  const handleEnd = useCallback(async () => {
    console.log("[LiveSession] Ending session...");
    const currentSessionId = sessionIdRef.current;
    const conversationSnapshot = useConversationStore.getState();
    const sessionSnapshot = useSessionStore.getState();
    const suggestionSnapshot = useSuggestionStore.getState();
    const feedbackContext = {
      surface: "live_session_end" as const,
      sessionId: currentSessionId,
      sessionStatus: sessionSnapshot.status,
      sessionStartedAt: sessionSnapshot.startedAt,
      sessionDurationSeconds: duration,
      scenePreset: sessionSnapshot.scenePreset,
      sceneDescription: sessionSnapshot.sceneDescription,
      copilotEnabled: sessionSnapshot.copilotEnabled,
      turnCount: conversationSnapshot.turns.length,
      recentTurns: conversationSnapshot.turns.slice(-12),
      currentStableText: conversationSnapshot.currentStableText,
      currentInterimText: conversationSnapshot.currentInterimText,
      mainWsStatus: conversationSnapshot.mainWsStatus,
      assistWsStatus: conversationSnapshot.assistWsStatus,
      aiSuggestions: suggestionSnapshot.suggestions,
      aiSuggestionTriggerTurnId: suggestionSnapshot.triggerTurnId,
    };
    analytics.capture("live_session_end_requested", {
      duration_seconds: duration,
      has_session_id: Boolean(currentSessionId),
      copilot_enabled: copilotEnabled,
    });

    voiceprintService.resetSessionState();
    await audioEngine.stop();
    resetMainAudioLevel();
    resetAssistAudioLevel();
    deepgramService.disconnect();
    assistStreamingService.disconnect();
    await translationService.stopPlayback();
    endSession();
    useConversationStore.getState().reset();
    useSuggestionStore.getState().clear();
    useReviewStore.getState().clear();

    if (currentSessionId) {
      try {
        deepgramTokenService.invalidate();
        await sessionManager.endSession({
          sessionId: currentSessionId,
          durationSeconds: duration,
        });
        historyService.generateRecap(currentSessionId).catch(console.warn);
      } catch (error) {
        console.error("[SessionManager] Failed to end session:", error);
      }
    }

    setDuration(0);
    sessionIdRef.current = null;
    assistShouldResumeRef.current = false;
    setForcedSpeaker(null);
    setShowCalibration(false);
    setShowEnrollment(false);
    setAssistState("idle");
    setAssistPreviewText("");
    setSessionStarting(false);
    setStartSessionUiState("idle");
    setSessionRemainingSecondsAtStart(null);
    clearSessionTimeoutResolution();
    await sessionManager.clearActiveSession();
    useAccessStore.getState().clear();
    console.log("[LiveSession] Session ended");
    analytics.capture("live_session_ended", {
      duration_seconds: duration,
      had_session_id: Boolean(currentSessionId),
    });
    void maybeOpenLiveSessionFeedback(feedbackContext, duration);
    useDebugStore.getState().reset();
    if (isFocused) {
      void preconnectMainSocket();
    }
  }, [
    duration,
    endSession,
    isFocused,
    preconnectMainSocket,
    resetAssistAudioLevel,
    resetMainAudioLevel,
    setForcedSpeaker,
    clearSessionTimeoutResolution,
  ]);

  useEffect(() => {
    if (!isFocused || !sessionTimeoutPendingRef.current) {
      return;
    }

    if (hasPaidAccess(subscriptionTier)) {
      clearSessionTimeoutResolution();
      resumeSession();
      void restoreMainConversationCapture().catch((error) => {
        console.error(
          "[LiveSession] Failed to resume conversation after upgrading:",
          error,
        );
      });
      analytics.capture("live_session_timeout_upgraded", {
        duration_seconds: duration,
        subscription_tier: subscriptionTier,
      });
      return;
    }

    clearSessionTimeoutResolution();
    void handleEnd();
    analytics.capture("live_session_timeout_ended_without_upgrade", {
      duration_seconds: duration,
      subscription_tier: subscriptionTier,
    });
  }, [
    clearSessionTimeoutResolution,
    duration,
    handleEnd,
    isFocused,
    restoreMainConversationCapture,
    resumeSession,
    subscriptionTier,
  ]);

  const isIdle = status === "idle" || status === "ended";
  const isActive =
    status === "active" || status === "paused" || status === "calibrating";
  const mainWsMeta = getWsStatusMeta(mainWsStatus, "Deepgram");
  const assistWsMeta = getWsStatusMeta(assistWsStatus, "Assist WS");
  const shouldShowAssistWs =
    assistState !== "idle" || assistWsStatus !== "idle";
  const effectiveStartSessionUiState: StartSessionUiState = isSessionStarting
    ? startSessionUiState
    : "idle";
  const shouldShowSessionTimeoutCountdown =
    status === "active" &&
    !isPaidSubscriber &&
    remainingSecondsUntilTimeout != null &&
    remainingSecondsUntilTimeout > 0 &&
    remainingSecondsUntilTimeout <= SESSION_TIMEOUT_WARNING_SECONDS &&
    !isResolvingSessionTimeout;

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
    copilotEnabled,
    copilotToastState,
    duration,
    remainingSessionSeconds: remainingSecondsUntilTimeout,
    shouldShowSessionTimeoutCountdown,
    showCalibration,
    assistState,
    assistPreviewText,
    isSendingSuggestion,
    isIdle,
    isActive,
    mainWsMeta,
    assistWsMeta,
    shouldShowAssistWs,
    showEnrollment,
    startSessionUiState: effectiveStartSessionUiState,
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
  };
}

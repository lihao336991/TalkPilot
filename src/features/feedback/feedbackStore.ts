import { create } from "zustand";

import type { Turn } from "@/features/live/store/conversationStore";
import type { ScenePreset, SessionStatus } from "@/features/live/store/sessionStore";

export type FeedbackSurface = "live_session_end" | "profile";

export type FeedbackContext = {
  surface: FeedbackSurface;
  sessionId?: string | null;
  sessionStatus?: SessionStatus | null;
  sessionStartedAt?: number | null;
  sessionDurationSeconds?: number | null;
  scenePreset?: ScenePreset | null;
  sceneDescription?: string | null;
  copilotEnabled?: boolean | null;
  turnCount?: number;
  recentTurns?: Turn[];
  currentStableText?: string | null;
  currentInterimText?: string | null;
  mainWsStatus?: string | null;
  assistWsStatus?: string | null;
  aiSuggestions?: Array<{ style: string; text: string }>;
  aiSuggestionTriggerTurnId?: string | null;
};

type FeedbackState = {
  requestId: number;
  context: FeedbackContext | null;
  openFeedback: (context: FeedbackContext) => void;
  closeFeedback: () => void;
};

export const useFeedbackStore = create<FeedbackState>((set) => ({
  requestId: 0,
  context: null,
  openFeedback: (context) =>
    set((state) => ({
      requestId: state.requestId + 1,
      context,
    })),
  closeFeedback: () => set({ context: null }),
}));

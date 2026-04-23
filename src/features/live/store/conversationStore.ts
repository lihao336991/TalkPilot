import { create } from 'zustand';
import type { StreamingConnectionStatus } from '@/features/live/services/StreamingWebSocketClient';
import type { ReviewResult } from '@/features/live/store/reviewStore';

export type TranslationDirection = 'to_learning' | 'to_native';
export type TranslationStatus = 'idle' | 'loading' | 'done' | 'error';
export type VoiceprintDecisionLabel = 'self' | 'other' | 'unknown';
export type SpeakerDecisionSource =
  | 'deepgram'
  | 'voiceprint'
  | 'hybrid'
  | 'forced'
  | null;
export type VoiceprintDecisionConfidence = 'high' | 'medium' | 'low';
export type VoiceprintDecisionReason =
  | 'similarity_high'
  | 'similarity_low'
  | 'between_thresholds'
  | 'insufficient_audio'
  | 'native_unavailable'
  | 'profile_unavailable';

export type Turn = {
  id: string;
  turnId: string;
  speaker: 'self' | 'other';
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
  detectedLanguage?: string;
  translation?: string;
  translationStatus?: TranslationStatus;
  translationDirection?: TranslationDirection;
  reviewScore?: 'green' | 'yellow' | 'red';
  review?: ReviewResult;
  isAssist?: boolean;
  assistSourceText?: string;
};

type TranslationUpdate = {
  translation?: string;
  translationStatus?: TranslationStatus;
  translationDirection?: TranslationDirection;
};

type ConversationState = {
  turns: Turn[];
  currentInterimText: string;
  currentInterimSpeaker: 'self' | 'other' | null;
  selfSpeakerId: number | null;
  forcedSpeaker: 'self' | 'other' | null;
  isListening: boolean;
  mainWsStatus: StreamingConnectionStatus;
  assistWsStatus: StreamingConnectionStatus;
  voiceprintEnabled: boolean;
  voiceprintEnrollmentReady: boolean;
  lastVoiceprintSimilarity: number | null;
  lastVoiceprintDecision: VoiceprintDecisionLabel | null;
  lastVoiceprintConfidence: VoiceprintDecisionConfidence | null;
  lastVoiceprintReason: VoiceprintDecisionReason | null;
  lastVoiceprintThresholdHigh: number | null;
  lastVoiceprintThresholdLow: number | null;
  lastVoiceprintInputDurationMs: number | null;
  lastVoiceprintMelFrameCount: number | null;
  lastSpeakerDecisionSource: SpeakerDecisionSource;

  addTurn: (turn: Turn) => void;
  updateTurn: (turnId: string, updates: Partial<Turn>) => void;
  removeTurn: (turnId: string) => void;
  setTurnReview: (turnId: string, review: ReviewResult) => void;
  setTurnTranslation: (turnId: string, update: TranslationUpdate) => void;
  updateInterim: (text: string, speaker: 'self' | 'other') => void;
  clearInterim: () => void;
  setSelfSpeakerId: (id: number | null) => void;
  setForcedSpeaker: (speaker: 'self' | 'other' | null) => void;
  setListening: (listening: boolean) => void;
  setMainWsStatus: (status: ConversationState['mainWsStatus']) => void;
  setAssistWsStatus: (status: ConversationState['assistWsStatus']) => void;
  setVoiceprintState: (
    state: Partial<
      Pick<
        ConversationState,
        | 'voiceprintEnabled'
        | 'voiceprintEnrollmentReady'
        | 'lastVoiceprintSimilarity'
        | 'lastVoiceprintDecision'
        | 'lastVoiceprintConfidence'
        | 'lastVoiceprintReason'
        | 'lastVoiceprintThresholdHigh'
        | 'lastVoiceprintThresholdLow'
        | 'lastVoiceprintInputDurationMs'
        | 'lastVoiceprintMelFrameCount'
      >
    >,
  ) => void;
  setSpeakerDecisionSource: (source: SpeakerDecisionSource) => void;
  reset: () => void;
};

const initialState = {
  turns: [] as Turn[],
  currentInterimText: '',
  currentInterimSpeaker: null as 'self' | 'other' | null,
  selfSpeakerId: null as number | null,
  forcedSpeaker: null as 'self' | 'other' | null,
  isListening: false,
  mainWsStatus: 'idle' as StreamingConnectionStatus,
  assistWsStatus: 'idle' as StreamingConnectionStatus,
  voiceprintEnabled: false,
  voiceprintEnrollmentReady: false,
  lastVoiceprintSimilarity: null,
  lastVoiceprintDecision: null as VoiceprintDecisionLabel | null,
  lastVoiceprintConfidence: null as VoiceprintDecisionConfidence | null,
  lastVoiceprintReason: null as VoiceprintDecisionReason | null,
  lastVoiceprintThresholdHigh: null,
  lastVoiceprintThresholdLow: null,
  lastVoiceprintInputDurationMs: null,
  lastVoiceprintMelFrameCount: null,
  lastSpeakerDecisionSource: null as SpeakerDecisionSource,
};

export const useConversationStore = create<ConversationState>((set) => ({
  ...initialState,

  addTurn: (turn) =>
    set((state) => ({ turns: [...state.turns, turn] })),

  updateTurn: (turnId, updates) =>
    set((state) => ({
      turns: state.turns.map((t) => (t.id === turnId ? { ...t, ...updates } : t)),
    })),

  removeTurn: (turnId) =>
    set((state) => ({
      turns: state.turns.filter((t) => t.id !== turnId),
    })),

  setTurnReview: (turnId, review) =>
    set((state) => ({
      turns: state.turns.map((turn) =>
        turn.turnId === turnId
          ? {
              ...turn,
              review,
              reviewScore: review.overallScore,
            }
          : turn,
      ),
    })),

  setTurnTranslation: (turnId, update) =>
    set((state) => ({
      turns: state.turns.map((turn) =>
        turn.turnId === turnId
          ? {
              ...turn,
              ...(update.translation !== undefined
                ? { translation: update.translation }
                : {}),
              ...(update.translationStatus !== undefined
                ? { translationStatus: update.translationStatus }
                : {}),
              ...(update.translationDirection !== undefined
                ? { translationDirection: update.translationDirection }
                : {}),
            }
          : turn,
      ),
    })),

  updateInterim: (text, speaker) =>
    set({ currentInterimText: text, currentInterimSpeaker: speaker }),

  clearInterim: () =>
    set({ currentInterimText: '', currentInterimSpeaker: null }),

  setSelfSpeakerId: (id) =>
    set({ selfSpeakerId: id }),

  setForcedSpeaker: (speaker) =>
    set({ forcedSpeaker: speaker }),

  setListening: (listening) =>
    set({ isListening: listening }),

  setMainWsStatus: (status) =>
    set({ mainWsStatus: status }),

  setAssistWsStatus: (status) =>
    set({ assistWsStatus: status }),

  setVoiceprintState: (voiceprintState) =>
    set((state) => ({ ...state, ...voiceprintState })),

  setSpeakerDecisionSource: (source) =>
    set({ lastSpeakerDecisionSource: source }),

  reset: () =>
    set(initialState),
}));

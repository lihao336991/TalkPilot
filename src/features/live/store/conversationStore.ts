import { create } from 'zustand';
import type { StreamingConnectionStatus } from '@/features/live/services/StreamingWebSocketClient';
import type { ReviewResult } from '@/features/live/store/reviewStore';

export type Turn = {
  id: string;
  turnId: string;
  speaker: 'self' | 'other';
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
  reviewScore?: 'green' | 'yellow' | 'red';
  review?: ReviewResult;
  isAssist?: boolean;
  assistSourceText?: string;
};

type ConversationState = {
  turns: Turn[];
  currentInterimText: string;
  currentInterimSpeaker: 'self' | 'other' | null;
  selfSpeakerId: number | null;
  forcedSpeaker: 'self' | 'other' | null;
  // 松开“模拟对方”按钮后，不立即清除 forcedSpeaker，而是在当前一句话的 UtteranceEnd 再清除
  releaseForcedOnUtteranceEnd: boolean;
  isListening: boolean;
  // WebSocket 状态：主会话与母语救场独立维护，避免互相污染 UI。
  mainWsStatus: StreamingConnectionStatus;
  assistWsStatus: StreamingConnectionStatus;

  addTurn: (turn: Turn) => void;
  updateTurn: (turnId: string, updates: Partial<Turn>) => void;
  removeTurn: (turnId: string) => void;
  setTurnReview: (turnId: string, review: ReviewResult) => void;
  updateInterim: (text: string, speaker: 'self' | 'other') => void;
  clearInterim: () => void;
  setSelfSpeakerId: (id: number | null) => void;
  setForcedSpeaker: (speaker: 'self' | 'other' | null) => void;
  setReleaseForcedOnUtteranceEnd: (pending: boolean) => void;
  setListening: (listening: boolean) => void;
  setMainWsStatus: (status: ConversationState['mainWsStatus']) => void;
  setAssistWsStatus: (status: ConversationState['assistWsStatus']) => void;
  reset: () => void;
};

const initialState = {
  turns: [] as Turn[],
  currentInterimText: '',
  currentInterimSpeaker: null as 'self' | 'other' | null,
  selfSpeakerId: null as number | null,
  forcedSpeaker: null as 'self' | 'other' | null,
  releaseForcedOnUtteranceEnd: false,
  isListening: false,
  mainWsStatus: 'idle' as StreamingConnectionStatus,
  assistWsStatus: 'idle' as StreamingConnectionStatus,
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

  updateInterim: (text, speaker) =>
    set({ currentInterimText: text, currentInterimSpeaker: speaker }),

  clearInterim: () =>
    set({ currentInterimText: '', currentInterimSpeaker: null }),

  setSelfSpeakerId: (id) =>
    set({ selfSpeakerId: id }),

  setForcedSpeaker: (speaker) =>
    set({ forcedSpeaker: speaker }),

  setReleaseForcedOnUtteranceEnd: (pending) =>
    set({ releaseForcedOnUtteranceEnd: pending }),

  setListening: (listening) =>
    set({ isListening: listening }),

  setMainWsStatus: (status) =>
    set({ mainWsStatus: status }),

  setAssistWsStatus: (status) =>
    set({ assistWsStatus: status }),

  reset: () =>
    set(initialState),
}));

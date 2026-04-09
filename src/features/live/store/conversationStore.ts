import { create } from 'zustand';

export type Turn = {
  id: string;
  turnId: string;
  speaker: 'self' | 'other';
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp: number;
  reviewScore?: 'green' | 'yellow' | 'red';
};

type ConversationState = {
  turns: Turn[];
  currentInterimText: string;
  currentInterimSpeaker: 'self' | 'other' | null;
  selfSpeakerId: number | null;
  isListening: boolean;

  addTurn: (turn: Turn) => void;
  updateInterim: (text: string, speaker: 'self' | 'other') => void;
  clearInterim: () => void;
  setSelfSpeakerId: (id: number | null) => void;
  setListening: (listening: boolean) => void;
  reset: () => void;
};

const initialState = {
  turns: [] as Turn[],
  currentInterimText: '',
  currentInterimSpeaker: null as 'self' | 'other' | null,
  selfSpeakerId: null as number | null,
  isListening: false,
};

export const useConversationStore = create<ConversationState>((set) => ({
  ...initialState,

  addTurn: (turn) =>
    set((state) => ({ turns: [...state.turns, turn] })),

  updateInterim: (text, speaker) =>
    set({ currentInterimText: text, currentInterimSpeaker: speaker }),

  clearInterim: () =>
    set({ currentInterimText: '', currentInterimSpeaker: null }),

  setSelfSpeakerId: (id) =>
    set({ selfSpeakerId: id }),

  setListening: (listening) =>
    set({ isListening: listening }),

  reset: () =>
    set(initialState),
}));

import { create } from 'zustand';

export type Suggestion = {
  style: 'formal' | 'casual' | 'simple';
  text: string;
};

type SuggestionState = {
  suggestions: Suggestion[];
  isLoading: boolean;
  streamBuffer: string;
  triggerTurnId: string | null;

  startLoading: (turnId: string) => void;
  appendChunk: (chunk: string) => void;
  finalizeSuggestions: (suggestions: Suggestion[]) => void;
  clear: () => void;
};

const initialState = {
  suggestions: [] as Suggestion[],
  isLoading: false,
  streamBuffer: '',
  triggerTurnId: null as string | null,
};

export const useSuggestionStore = create<SuggestionState>((set) => ({
  ...initialState,

  startLoading: (turnId) =>
    set({ isLoading: true, streamBuffer: '', suggestions: [], triggerTurnId: turnId }),

  appendChunk: (chunk) =>
    set((state) => ({ streamBuffer: state.streamBuffer + chunk })),

  finalizeSuggestions: (suggestions) =>
    set({ suggestions, isLoading: false, streamBuffer: '' }),

  clear: () =>
    set(initialState),
}));

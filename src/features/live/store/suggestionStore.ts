import { create } from 'zustand';

export type Suggestion = {
  style: 'formal' | 'casual' | 'simple';
  text: string;
};

type SuggestionState = {
  suggestions: Suggestion[];
  isLoading: boolean;
  triggerTurnId: string | null;

  startLoading: (turnId: string) => void;
  finalizeSuggestions: (suggestions: Suggestion[]) => void;
  clear: () => void;
};

const initialState = {
  suggestions: [] as Suggestion[],
  isLoading: false,
  triggerTurnId: null as string | null,
};

export const useSuggestionStore = create<SuggestionState>((set) => ({
  ...initialState,

  startLoading: (turnId) =>
    set({ isLoading: true, suggestions: [], triggerTurnId: turnId }),

  finalizeSuggestions: (suggestions) =>
    set({ suggestions, isLoading: false }),

  clear: () =>
    set(initialState),
}));

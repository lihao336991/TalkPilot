import { create } from "zustand";

type AudioInputState = {
  mainLevel: number;
  assistLevel: number;
  hasMainInput: boolean;
  hasAssistInput: boolean;
  setMainLevel: (level: number) => void;
  setAssistLevel: (level: number) => void;
  resetMain: () => void;
  resetAssist: () => void;
  reset: () => void;
};

const initialState = {
  mainLevel: 0,
  assistLevel: 0,
  hasMainInput: false,
  hasAssistInput: false,
};

function clampLevel(level: number) {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.min(1, Math.max(0, level));
}

export const useAudioInputStore = create<AudioInputState>((set) => ({
  ...initialState,
  setMainLevel: (level) =>
    set({ mainLevel: clampLevel(level), hasMainInput: true }),
  setAssistLevel: (level) =>
    set({ assistLevel: clampLevel(level), hasAssistInput: true }),
  resetMain: () => set({ mainLevel: 0, hasMainInput: false }),
  resetAssist: () => set({ assistLevel: 0, hasAssistInput: false }),
  reset: () => set(initialState),
}));

import { create } from "zustand";

type AudioInputState = {
  mainLevel: number;
  assistLevel: number;
  setMainLevel: (level: number) => void;
  setAssistLevel: (level: number) => void;
  reset: () => void;
};

const initialState = {
  mainLevel: 0,
  assistLevel: 0,
};

function clampLevel(level: number) {
  if (!Number.isFinite(level)) {
    return 0;
  }
  return Math.min(1, Math.max(0, level));
}

export const useAudioInputStore = create<AudioInputState>((set) => ({
  ...initialState,
  setMainLevel: (level) => set({ mainLevel: clampLevel(level) }),
  setAssistLevel: (level) => set({ assistLevel: clampLevel(level) }),
  reset: () => set(initialState),
}));

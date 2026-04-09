import { create } from 'zustand';

export type ScenePreset = 'academic' | 'daily' | 'professional' | 'social' | 'custom' | 'free';

export type SessionStatus = 'idle' | 'calibrating' | 'active' | 'paused' | 'ended';

type SessionState = {
  sessionId: string | null;
  status: SessionStatus;
  scenePreset: ScenePreset;
  sceneDescription: string;
  startedAt: number | null;
  dailyMinutesUsed: number;
  dailyMinutesLimit: number;

  startSession: (sessionId: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  setScene: (preset: ScenePreset, description?: string) => void;
  updateUsage: (minutes: number) => void;
  reset: () => void;
};

const initialState = {
  sessionId: null as string | null,
  status: 'idle' as SessionStatus,
  scenePreset: 'free' as ScenePreset,
  sceneDescription: '',
  startedAt: null as number | null,
  dailyMinutesUsed: 0,
  dailyMinutesLimit: 30,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  startSession: (sessionId) =>
    set({ sessionId, status: 'active', startedAt: Date.now() }),

  pauseSession: () =>
    set({ status: 'paused' }),

  resumeSession: () =>
    set({ status: 'active' }),

  endSession: () =>
    set({ status: 'ended' }),

  setScene: (preset, description) =>
    set({ scenePreset: preset, sceneDescription: description ?? '' }),

  updateUsage: (minutes) =>
    set({ dailyMinutesUsed: minutes }),

  reset: () =>
    set(initialState),
}));

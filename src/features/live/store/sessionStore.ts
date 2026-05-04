import { create } from 'zustand';

export type ScenePreset = 'academic' | 'daily' | 'professional' | 'social' | 'custom' | 'free';

export type SessionStatus = 'idle' | 'calibrating' | 'active' | 'paused' | 'ended';

type SessionState = {
  sessionId: string | null;
  status: SessionStatus;
  isStarting: boolean;
  copilotEnabled: boolean;
  scenePreset: ScenePreset;
  sceneDescription: string;
  startedAt: number | null;
  dailyMinutesUsed: number;
  dailyMinutesLimit: number;
  isDailyLimitReached: boolean;

  startSession: (sessionId: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  setStarting: (starting: boolean) => void;
  setCopilotEnabled: (enabled: boolean) => void;
  setScene: (preset: ScenePreset, description?: string) => void;
  setUsageSummary: (payload: { minutesUsed: number; minutesLimit: number }) => void;
  setUsageLimit: (limit: number) => void;
  reset: () => void;
};

const initialState = {
  sessionId: null as string | null,
  status: 'idle' as SessionStatus,
  isStarting: false,
  copilotEnabled: true,
  scenePreset: 'free' as ScenePreset,
  sceneDescription: '',
  startedAt: null as number | null,
  dailyMinutesUsed: 0,
  dailyMinutesLimit: 10,
  isDailyLimitReached: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  startSession: (sessionId) =>
    set({
      sessionId,
      status: 'active',
      startedAt: Date.now(),
      isStarting: false,
      copilotEnabled: true,
    }),

  pauseSession: () =>
    set({ status: 'paused' }),

  resumeSession: () =>
    set({ status: 'active' }),

  endSession: () =>
    set({ sessionId: null, status: 'ended', startedAt: null, isStarting: false }),

  setStarting: (isStarting) =>
    set({ isStarting }),

  setCopilotEnabled: (copilotEnabled) =>
    set({ copilotEnabled }),

  setScene: (preset, description) =>
    set({ scenePreset: preset, sceneDescription: description ?? '' }),

  setUsageSummary: ({ minutesUsed, minutesLimit }) =>
    set({
      dailyMinutesUsed: minutesUsed,
      dailyMinutesLimit: minutesLimit,
      isDailyLimitReached: minutesUsed >= minutesLimit,
    }),

  setUsageLimit: (dailyMinutesLimit) =>
    set((state) => ({
      dailyMinutesLimit,
      isDailyLimitReached: state.dailyMinutesUsed >= dailyMinutesLimit,
    })),

  reset: () =>
    set(initialState),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type IosAudioSessionMode = 'voiceChat' | 'measurement' | 'default';

export const IOS_AUDIO_SESSION_MODES: IosAudioSessionMode[] = [
  'voiceChat',
  'measurement',
  'default',
];

export const DEFAULT_IOS_AUDIO_SESSION_MODE: IosAudioSessionMode = 'voiceChat';

export function isIosAudioSessionMode(value: unknown): value is IosAudioSessionMode {
  return (
    typeof value === 'string' &&
    IOS_AUDIO_SESSION_MODES.includes(value as IosAudioSessionMode)
  );
}

type AudioDebugState = {
  iosAudioSessionMode: IosAudioSessionMode;
  setIosAudioSessionMode: (value: IosAudioSessionMode) => void;
};

export const useAudioDebugStore = create<AudioDebugState>()(
  persist(
    (set) => ({
      iosAudioSessionMode: DEFAULT_IOS_AUDIO_SESSION_MODE,
      setIosAudioSessionMode: (value) => set({ iosAudioSessionMode: value }),
    }),
    {
      name: 'talkpilot-audio-debug-settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        iosAudioSessionMode: state.iosAudioSessionMode,
      }),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<{
          iosAudioSessionMode: unknown;
        }>;

        return {
          iosAudioSessionMode: isIosAudioSessionMode(state.iosAudioSessionMode)
            ? state.iosAudioSessionMode
            : DEFAULT_IOS_AUDIO_SESSION_MODE,
          setIosAudioSessionMode: undefined,
        } as Partial<AudioDebugState>;
      },
    },
  ),
);

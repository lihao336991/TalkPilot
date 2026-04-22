import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_LEARNING_LANGUAGE,
  DEFAULT_UI_LOCALE,
  type LearningLanguage,
  type UiLocale,
} from "@/shared/i18n/config";

type LocaleState = {
  hasHydrated: boolean;
  followSystemUiLocale: boolean;
  uiLocale: UiLocale;
  learningLanguage: LearningLanguage;
  setHasHydrated: (value: boolean) => void;
  setFollowSystemUiLocale: (value: boolean) => void;
  setUiLocale: (locale: UiLocale) => void;
  setSystemUiLocale: (locale: UiLocale) => void;
  setLearningLanguage: (language: LearningLanguage) => void;
};

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      followSystemUiLocale: true,
      uiLocale: DEFAULT_UI_LOCALE,
      learningLanguage: DEFAULT_LEARNING_LANGUAGE,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setFollowSystemUiLocale: (value) => set({ followSystemUiLocale: value }),
      setUiLocale: (locale) =>
        set({
          uiLocale: locale,
          followSystemUiLocale: false,
        }),
      setSystemUiLocale: (locale) =>
        set({
          uiLocale: locale,
        }),
      setLearningLanguage: (language) => set({ learningLanguage: language }),
    }),
    {
      name: "talkpilot-locale-settings",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        followSystemUiLocale: state.followSystemUiLocale,
        uiLocale: state.uiLocale,
        learningLanguage: state.learningLanguage,
      }),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as {
          followSystemUiLocale?: boolean;
          uiLocale?: UiLocale;
          learningLanguage?: LearningLanguage;
          targetLanguage?: LearningLanguage;
        };

        return {
          ...state,
          learningLanguage:
            state.learningLanguage ??
            state.targetLanguage ??
            DEFAULT_LEARNING_LANGUAGE,
          uiLocale: state.uiLocale ?? DEFAULT_UI_LOCALE,
          followSystemUiLocale: state.followSystemUiLocale ?? true,
          hasHydrated: false,
          setHasHydrated: undefined,
          setFollowSystemUiLocale: undefined,
          setUiLocale: undefined,
          setSystemUiLocale: undefined,
          setLearningLanguage: undefined,
        } as Partial<LocaleState>;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("[I18n] Failed to hydrate locale store:", error);
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_DEBUG_LLM_PROVIDER,
  DEFAULT_DEBUG_LLM_ROUTE_MODE,
  getDefaultDebugLlmModel,
  isDebugLlmProvider,
  type DebugLlmProvider,
  type DebugLlmRouteMode,
} from "@/shared/llm/debugConfig";

type LlmDebugState = {
  routeMode: DebugLlmRouteMode;
  provider: DebugLlmProvider;
  model: string;
  setRouteMode: (value: DebugLlmRouteMode) => void;
  setProvider: (value: DebugLlmProvider) => void;
  setModel: (value: string) => void;
};

export const useLlmDebugStore = create<LlmDebugState>()(
  persist(
    (set) => ({
      routeMode: DEFAULT_DEBUG_LLM_ROUTE_MODE,
      provider: DEFAULT_DEBUG_LLM_PROVIDER,
      model: getDefaultDebugLlmModel(DEFAULT_DEBUG_LLM_PROVIDER),
      setRouteMode: (value) => set({ routeMode: value }),
      setProvider: (value) =>
        set((state) => {
          const nextModel =
            state.provider === value ? state.model : getDefaultDebugLlmModel(value);

          return {
            routeMode: "manual",
            provider: value,
            model: nextModel,
          };
        }),
      setModel: (value) => set({ routeMode: "manual", model: value }),
    }),
    {
      name: "talkpilot-llm-debug-settings",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        routeMode: state.routeMode,
        provider: state.provider,
        model: state.model,
      }),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<{
          routeMode: DebugLlmRouteMode;
          provider: DebugLlmProvider | string;
          model: string;
        }>;
        const provider = isDebugLlmProvider(state.provider)
          ? state.provider
          : DEFAULT_DEBUG_LLM_PROVIDER;
        const model =
          typeof state.model === "string" && state.model.trim().length > 0
            ? state.model
            : getDefaultDebugLlmModel(provider);

        return {
          routeMode:
            state.routeMode === "manual" ? "manual" : DEFAULT_DEBUG_LLM_ROUTE_MODE,
          provider,
          model,
          setRouteMode: undefined,
          setProvider: undefined,
          setModel: undefined,
        } as Partial<LlmDebugState>;
      },
    },
  ),
);

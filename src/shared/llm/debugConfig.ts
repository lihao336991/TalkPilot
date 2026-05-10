export type DebugLlmRouteMode = "auto" | "manual";
export type DebugLlmProvider = "cerebras" | "together";

export type DebugLlmModelOption = {
  id: string;
  label: string;
  provider: DebugLlmProvider;
  description: string;
};

export const DEBUG_LLM_ROUTE_MODE_HEADER = "x-llm-route-mode";
export const DEBUG_LLM_PROVIDER_HEADER = "x-llm-preferred-provider";
export const DEBUG_LLM_MODEL_HEADER = "x-llm-preferred-model";

export const DEFAULT_DEBUG_LLM_ROUTE_MODE: DebugLlmRouteMode = "auto";
export const DEFAULT_DEBUG_LLM_PROVIDER: DebugLlmProvider = "cerebras";

export const DEBUG_LLM_MODEL_OPTIONS: Record<
  DebugLlmProvider,
  DebugLlmModelOption[]
> = {
  cerebras: [
    {
      id: "gpt-oss-120b",
      label: "GPT OSS 120B",
      provider: "cerebras",
      description: "High-quality Cerebras default for review and recap.",
    },
    {
      id: "llama3.1-8b",
      label: "Llama 3.1 8B",
      provider: "cerebras",
      description: "Fast Cerebras baseline for latency comparison only.",
    },
  ],
  together: [
    {
      id: "openai/gpt-oss-120b",
      label: "GPT OSS 120B",
      provider: "together",
      description: "Higher-quality Together route for review and session recap.",
    },
    {
      id: "Qwen/Qwen3.5-9B",
      label: "Qwen 3.5 9B",
      provider: "together",
      description: "Faster Together option for suggestion and comparison tests.",
    },
  ],
};

export function getDefaultDebugLlmModel(provider: DebugLlmProvider): string {
  return DEBUG_LLM_MODEL_OPTIONS[provider][0]?.id ?? "";
}

export function isDebugLlmProvider(value: string | null | undefined): value is DebugLlmProvider {
  return value === "cerebras" || value === "together";
}

export function buildLlmDebugHeaders(config: {
  routeMode: DebugLlmRouteMode;
  provider: DebugLlmProvider;
  model: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    [DEBUG_LLM_ROUTE_MODE_HEADER]: config.routeMode,
  };

  if (config.routeMode === "manual") {
    headers[DEBUG_LLM_PROVIDER_HEADER] = config.provider;
    headers[DEBUG_LLM_MODEL_HEADER] = config.model;
  }

  return headers;
}

export function formatLlmMetaDetail(headers: Headers): string {
  const provider = headers.get("x-llm-provider");
  const model = headers.get("x-llm-model");
  const keyPrefix = headers.get("x-llm-key-prefix");
  const routeMode = headers.get("x-llm-route-mode");
  const attempts = headers.get("x-llm-attempts");
  const parts = [
    routeMode ? `${routeMode}` : null,
    provider,
    model,
    attempts ? attempts : null,
    keyPrefix ? `key ${keyPrefix}` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

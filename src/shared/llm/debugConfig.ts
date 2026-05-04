export type DebugLlmRouteMode = "auto" | "manual";
export type DebugLlmProvider = "cerebras" | "groq";

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
  groq: [
    {
      id: "llama-3.1-8b-instant",
      label: "Llama 3.1 8B Instant",
      provider: "groq",
      description: "Fast Groq small model for low latency tests.",
    },
    {
      id: "llama-3.3-70b-versatile",
      label: "Llama 3.3 70B",
      provider: "groq",
      description: "Current Groq larger model for quality comparison.",
    },
  ],
};

export function getDefaultDebugLlmModel(provider: DebugLlmProvider): string {
  return DEBUG_LLM_MODEL_OPTIONS[provider][0]?.id ?? "";
}

export function isDebugLlmProvider(value: string | null | undefined): value is DebugLlmProvider {
  return value === "cerebras" || value === "groq";
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

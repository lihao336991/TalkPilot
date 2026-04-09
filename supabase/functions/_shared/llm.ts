import OpenAI from "https://esm.sh/openai@4";

export type SupportedLlmProvider = "openai" | "deepseek" | "minimax";

type LlmRuntime = {
  provider: SupportedLlmProvider;
  model: string;
  client: OpenAI;
};

const DEFAULT_PROVIDER: SupportedLlmProvider = "minimax";

const DEFAULT_MODELS: Record<SupportedLlmProvider, string> = {
  openai: "gpt-4o-mini",
  deepseek: "deepseek-chat",
  minimax: "MiniMax-M2.5",
};

const MINIMAX_MODEL_ALIASES: Record<string, string> = {
  "minimax-2.5": "MiniMax-M2.5",
  "minimax-2.5-highspeed": "MiniMax-M2.5-highspeed",
  "minimax-m2.5": "MiniMax-M2.5",
  "minimax-m2.5-highspeed": "MiniMax-M2.5-highspeed",
  "minimax-m2.7": "MiniMax-M2.7",
  "minimax-m2.7-highspeed": "MiniMax-M2.7-highspeed",
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function normalizeProvider(rawProvider: string | undefined): SupportedLlmProvider {
  const normalized = rawProvider?.trim().toLowerCase();

  if (normalized === "openai" || normalized === "deepseek" || normalized === "minimax") {
    return normalized;
  }

  return DEFAULT_PROVIDER;
}

function resolveModel(provider: SupportedLlmProvider, rawModel: string | undefined): string {
  const normalizedModel = rawModel?.trim();

  if (!normalizedModel) {
    return DEFAULT_MODELS[provider];
  }

  if (provider !== "minimax") {
    return normalizedModel;
  }

  return MINIMAX_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
}

export function createLlmRuntime(): LlmRuntime {
  const provider = normalizeProvider(Deno.env.get("LLM_PROVIDER"));

  if (provider === "deepseek") {
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey: getRequiredEnv("DEEPSEEK_API_KEY"),
        baseURL: Deno.env.get("DEEPSEEK_BASE_URL")?.trim() || "https://api.deepseek.com/v1",
      }),
    };
  }

  if (provider === "minimax") {
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey: getRequiredEnv("MINIMAX_API_KEY"),
        baseURL: Deno.env.get("MINIMAX_BASE_URL")?.trim() || "https://api.minimax.io/v1",
      }),
    };
  }

  return {
    provider,
    model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
    client: new OpenAI({
      apiKey: getRequiredEnv("OPENAI_API_KEY"),
      baseURL: Deno.env.get("OPENAI_BASE_URL")?.trim() || undefined,
    }),
  };
}

export function withLlmDefaults<T extends Record<string, unknown>>(
  runtime: LlmRuntime,
  payload: T,
): T & { model: string; extra_body?: { reasoning_split: true } } {
  if (runtime.provider === "minimax") {
    return {
      ...payload,
      model: runtime.model,
      extra_body: { reasoning_split: true },
    };
  }

  return {
    ...payload,
    model: runtime.model,
  };
}

export function extractJsonObject(content: string): string {
  const trimmed = content.trim();

  if (!trimmed) {
    return "{}";
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

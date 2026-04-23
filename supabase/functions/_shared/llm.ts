/// <reference path="./editor-shims.d.ts" />

// @ts-ignore Deno resolves this remote dependency at runtime.
import OpenAI from "https://esm.sh/openai@4";

export type SupportedLlmProvider =
  | "openai"
  | "deepseek"
  | "minimax"
  | "gemini"
  | "groq"
  | "together";

type LlmRuntime = {
  provider: SupportedLlmProvider;
  model: string;
  client: any;
  apiKeyPrefix: string;
};

const DEFAULT_PROVIDER: SupportedLlmProvider = "gemini";

const DEFAULT_MODELS: Record<SupportedLlmProvider, string> = {
  openai: "gpt-4o-mini",
  deepseek: "deepseek-chat",
  minimax: "MiniMax-M2.5-highspeed",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  together: "Qwen/Qwen3.5-9B",
};

const MINIMAX_MODEL_ALIASES: Record<string, string> = {
  "minimax-2.5": "MiniMax-M2.5",
  "minimax-2.5-highspeed": "MiniMax-M2.5-highspeed",
  "minimax-m2.5": "MiniMax-M2.5",
  "minimax-m2.5-highspeed": "MiniMax-M2.5-highspeed",
  "minimax-m2.7": "MiniMax-M2.7",
  "minimax-m2.7-highspeed": "MiniMax-M2.7-highspeed",
};

const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash-latest": "gemini-2.5-flash",
  "2.5-flash": "gemini-2.5-flash",
};

const GROQ_MODEL_ALIASES: Record<string, string> = {
  "llama-3.3-70b": "llama-3.3-70b-versatile",
  "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
  "llama3.3-70b": "llama-3.3-70b-versatile",
  "groq-llama-3.3-70b": "llama-3.3-70b-versatile",
};

const TOGETHER_MODEL_ALIASES: Record<string, string> = {
  "qwen/qwen3.5-9b": "Qwen/Qwen3.5-9B",
  "qwen3.5-9b": "Qwen/Qwen3.5-9B",
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 8);
}

function normalizeProvider(rawProvider: string | undefined): SupportedLlmProvider {
  const normalized = rawProvider?.trim().toLowerCase();

  if (
    normalized === "openai" ||
    normalized === "deepseek" ||
    normalized === "minimax" ||
    normalized === "gemini" ||
    normalized === "groq" ||
    normalized === "together"
  ) {
    return normalized;
  }

  return DEFAULT_PROVIDER;
}

function resolveModel(provider: SupportedLlmProvider, rawModel: string | undefined): string {
  const normalizedModel = rawModel?.trim();

  if (!normalizedModel) {
    return DEFAULT_MODELS[provider];
  }

  if (provider === "minimax") {
    return MINIMAX_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
  }

  if (provider === "gemini") {
    return GEMINI_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
  }

  if (provider === "groq") {
    return GROQ_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
  }

  if (provider === "together") {
    return TOGETHER_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
  }

  return normalizedModel;
}

export function createLlmRuntime(): LlmRuntime {
  const provider = normalizeProvider(Deno.env.get("LLM_PROVIDER"));

  if (provider === "deepseek") {
    const apiKey = getRequiredEnv("DEEPSEEK_API_KEY");
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey,
        baseURL: Deno.env.get("DEEPSEEK_BASE_URL")?.trim() || "https://api.deepseek.com/v1",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  if (provider === "minimax") {
    const apiKey = getRequiredEnv("MINIMAX_API_KEY");
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey,
        baseURL: Deno.env.get("MINIMAX_BASE_URL")?.trim() || "https://api.minimax.chat/v1",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  if (provider === "gemini") {
    const apiKey = getRequiredEnv("GEMINI_API_KEY");
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey,
        baseURL:
          Deno.env.get("GEMINI_BASE_URL")?.trim() ||
          "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  if (provider === "groq") {
    const apiKey = getRequiredEnv("GROQ_API_KEY");
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey,
        baseURL: Deno.env.get("GROQ_BASE_URL")?.trim() || "https://api.groq.com/openai/v1",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  if (provider === "together") {
    const apiKey = getRequiredEnv("TOGETHER_API_KEY");
    return {
      provider,
      model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
      client: new OpenAI({
        apiKey,
        baseURL: Deno.env.get("TOGETHER_BASE_URL")?.trim() || "https://api.together.xyz/v1",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  return {
    provider,
    model: resolveModel(provider, Deno.env.get("LLM_MODEL")),
    client: new OpenAI({
      apiKey,
      baseURL: Deno.env.get("OPENAI_BASE_URL")?.trim() || undefined,
    }),
    apiKeyPrefix: getApiKeyPrefix(apiKey),
  };
}

export function withLlmDefaults<T extends Record<string, unknown>>(
  runtime: LlmRuntime,
  payload: T,
): T & { model: string } {
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

export function buildLlmResponseHeaders(
  runtime: LlmRuntime,
  overrides: Record<string, string> = {},
): Headers {
  const headers = new Headers({
    "X-LLM-Provider": runtime.provider,
    "X-LLM-Model": runtime.model,
    "X-LLM-Key-Prefix": runtime.apiKeyPrefix,
    "Access-Control-Expose-Headers":
      "X-LLM-Provider, X-LLM-Model, X-LLM-Key-Prefix",
  });

  for (const [key, value] of Object.entries(overrides)) {
    headers.set(key, value);
  }

  return headers;
}

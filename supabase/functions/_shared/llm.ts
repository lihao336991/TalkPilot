/// <reference path="./editor-shims.d.ts" />

// @ts-ignore Deno resolves this remote dependency at runtime.
import OpenAI from "https://esm.sh/openai@4";

export type SupportedLlmProvider =
  | "openai"
  | "deepseek"
  | "minimax"
  | "gemini"
  | "groq"
  | "cerebras"
  | "together";

type LlmRuntime = {
  provider: SupportedLlmProvider;
  model: string;
  client: any;
  apiKeyPrefix: string;
};

type SupportedAutoLlmProvider = "cerebras" | "groq";

export type LlmRouteMode = "auto" | "manual";

export type LlmAttempt = {
  provider: SupportedLlmProvider;
  model: string;
  status: "success" | "error" | "skipped";
  detail?: string;
};

export type LlmExecutionOptions = {
  providerEnvName?: string;
  modelEnvName?: string;
  defaultProvider?: SupportedLlmProvider;
  defaultModel?: string;
};

const DEFAULT_PROVIDER: SupportedLlmProvider = "cerebras";

const DEFAULT_MODELS: Record<SupportedLlmProvider, string> = {
  openai: "gpt-4o-mini",
  deepseek: "deepseek-chat",
  minimax: "MiniMax-M2.5-highspeed",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  cerebras: "gpt-oss-120b",
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
  "llama-3.1-8b": "llama-3.1-8b-instant",
  "llama-3.1-8b-instant": "llama-3.1-8b-instant",
  "llama3.1-8b": "llama-3.1-8b-instant",
  "llama-3.3-70b": "llama-3.3-70b-versatile",
  "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
  "llama3.3-70b": "llama-3.3-70b-versatile",
  "groq-llama-3.3-70b": "llama-3.3-70b-versatile",
};

const CEREBRAS_MODEL_ALIASES: Record<string, string> = {
  "gpt oss 120b": "gpt-oss-120b",
  "gpt-oss-120b": "gpt-oss-120b",
  "llama 3.1-8b": "llama3.1-8b",
  "llama 3.1 8b": "llama3.1-8b",
  "llama-3.1-8b": "llama3.1-8b",
  "llama3.1-8b": "llama3.1-8b",
};

const TOGETHER_MODEL_ALIASES: Record<string, string> = {
  "qwen/qwen3.5-9b": "Qwen/Qwen3.5-9B",
  "qwen3.5-9b": "Qwen/Qwen3.5-9B",
};

const REQUEST_ROUTE_MODE_HEADER = "x-llm-route-mode";
const REQUEST_PROVIDER_HEADER = "x-llm-preferred-provider";
const REQUEST_MODEL_HEADER = "x-llm-preferred-model";

const DEFAULT_AUTO_PROVIDER_ORDER: SupportedAutoLlmProvider[] = ["cerebras", "groq"];

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
    normalized === "cerebras" ||
    normalized === "together"
  ) {
    return normalized;
  }

  return DEFAULT_PROVIDER;
}

function parseSupportedProvider(rawProvider: string | undefined): SupportedLlmProvider | null {
  const normalized = rawProvider?.trim().toLowerCase();

  if (
    normalized === "openai" ||
    normalized === "deepseek" ||
    normalized === "minimax" ||
    normalized === "gemini" ||
    normalized === "groq" ||
    normalized === "cerebras" ||
    normalized === "together"
  ) {
    return normalized;
  }

  return null;
}

function isAutoCapableProvider(provider: SupportedLlmProvider): provider is SupportedAutoLlmProvider {
  return provider === "cerebras" || provider === "groq";
}

function getProviderApiKeyEnvName(provider: SupportedLlmProvider): string {
  switch (provider) {
    case "deepseek":
      return "DEEPSEEK_API_KEY";
    case "minimax":
      return "MINIMAX_API_KEY";
    case "gemini":
      return "GEMINI_API_KEY";
    case "groq":
      return "GROQ_API_KEY";
    case "cerebras":
      return "CEREBRAS_API_KEY";
    case "together":
      return "TOGETHER_API_KEY";
    default:
      return "OPENAI_API_KEY";
  }
}

function getProviderModelEnvName(provider: SupportedLlmProvider): string {
  switch (provider) {
    case "deepseek":
      return "DEEPSEEK_LLM_MODEL";
    case "minimax":
      return "MINIMAX_LLM_MODEL";
    case "gemini":
      return "GEMINI_LLM_MODEL";
    case "groq":
      return "GROQ_LLM_MODEL";
    case "cerebras":
      return "CEREBRAS_LLM_MODEL";
    case "together":
      return "TOGETHER_LLM_MODEL";
    default:
      return "OPENAI_LLM_MODEL";
  }
}

function getConfiguredModel(provider: SupportedLlmProvider, rawModelOverride?: string): string {
  return resolveModel(
    provider,
    rawModelOverride ??
      Deno.env.get(getProviderModelEnvName(provider)) ??
      (provider === normalizeProvider(Deno.env.get("LLM_PROVIDER"))
        ? Deno.env.get("LLM_MODEL")
        : undefined),
  );
}

function isProviderConfigured(provider: SupportedLlmProvider): boolean {
  const apiKey = Deno.env.get(getProviderApiKeyEnvName(provider))?.trim();
  return Boolean(apiKey);
}

function parseAutoProviderOrder(rawOrder: string | undefined): SupportedAutoLlmProvider[] {
  const configured = (rawOrder ?? "")
    .split(",")
    .map((value) => parseSupportedProvider(value))
    .filter(
      (provider): provider is SupportedAutoLlmProvider =>
        provider != null && isAutoCapableProvider(provider),
    );

  const deduped: SupportedAutoLlmProvider[] = [];
  for (const provider of configured) {
    if (!deduped.includes(provider)) {
      deduped.push(provider);
    }
  }

  for (const provider of DEFAULT_AUTO_PROVIDER_ORDER) {
    if (!deduped.includes(provider)) {
      deduped.push(provider);
    }
  }

  return deduped;
}

function parseRouteMode(req?: Request): LlmRouteMode {
  const value = req?.headers.get(REQUEST_ROUTE_MODE_HEADER)?.trim().toLowerCase();
  return value === "manual" ? "manual" : "auto";
}

function parseRequestedProvider(req?: Request): SupportedLlmProvider | null {
  const value = req?.headers.get(REQUEST_PROVIDER_HEADER);
  const provider = parseSupportedProvider(value ?? undefined);

  if (!value || !provider) {
    return null;
  }

  return provider;
}

function resolvePreferredCandidate(
  options?: LlmExecutionOptions,
): { provider: SupportedLlmProvider; model?: string } | null {
  const envProvider = options?.providerEnvName
    ? parseSupportedProvider(Deno.env.get(options.providerEnvName))
    : null;
  const envModel = options?.modelEnvName
    ? Deno.env.get(options.modelEnvName)?.trim() || undefined
    : undefined;
  const provider = envProvider ?? options?.defaultProvider ?? null;

  if (!provider) {
    return null;
  }

  return {
    provider,
    model: envModel ?? options?.defaultModel,
  };
}

function getAttemptDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return String(error);
}

function shouldFallbackToNextProvider(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status)
      : NaN;

  if ([401, 402, 403, 408, 409, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const detail = getAttemptDetail(error).toLowerCase();
  return (
    detail.includes("missing required env") ||
    detail.includes("timeout") ||
    detail.includes("network") ||
    detail.includes("fetch failed") ||
    detail.includes("connection")
  );
}

function formatAttempts(attempts: LlmAttempt[]): string {
  return attempts
    .map((attempt) => {
      const detail = attempt.detail ? `:${attempt.detail}` : "";
      return `${attempt.provider}/${attempt.model}/${attempt.status}${detail}`;
    })
    .join(" -> ");
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

  if (provider === "cerebras") {
    return CEREBRAS_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
  }

  if (provider === "together") {
    return TOGETHER_MODEL_ALIASES[normalizedModel.toLowerCase()] ?? normalizedModel;
  }

  return normalizedModel;
}

export function createLlmRuntime(): LlmRuntime {
  const provider = normalizeProvider(Deno.env.get("LLM_PROVIDER"));
  return createProviderRuntime(provider);
}

function createProviderRuntime(
  provider: SupportedLlmProvider,
  rawModelOverride?: string,
): LlmRuntime {
  const model = getConfiguredModel(provider, rawModelOverride);

  if (provider === "deepseek") {
    const apiKey = getRequiredEnv("DEEPSEEK_API_KEY");
    return {
      provider,
      model,
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
      model,
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
      model,
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
      model,
      client: new OpenAI({
        apiKey,
        baseURL: Deno.env.get("GROQ_BASE_URL")?.trim() || "https://api.groq.com/openai/v1",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  if (provider === "cerebras") {
    const apiKey = getRequiredEnv("CEREBRAS_API_KEY");
    return {
      provider,
      model,
      client: new OpenAI({
        apiKey,
        baseURL: Deno.env.get("CEREBRAS_BASE_URL")?.trim() || "https://api.cerebras.ai/v1",
      }),
      apiKeyPrefix: getApiKeyPrefix(apiKey),
    };
  }

  if (provider === "together") {
    const apiKey = getRequiredEnv("TOGETHER_API_KEY");
    return {
      provider,
      model,
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
    model,
    client: new OpenAI({
      apiKey,
      baseURL: Deno.env.get("OPENAI_BASE_URL")?.trim() || undefined,
    }),
    apiKeyPrefix: getApiKeyPrefix(apiKey),
  };
}

export async function runLlmChatCompletion<T extends Record<string, unknown>>(
  req: Request | undefined,
  payload: T,
  options?: LlmExecutionOptions,
): Promise<{
  runtime: LlmRuntime;
  completion: any;
  routeMode: LlmRouteMode;
  attempts: LlmAttempt[];
}> {
  const routeMode = parseRouteMode(req);
  const requestedProvider = parseRequestedProvider(req);
  const requestedModel = req?.headers.get(REQUEST_MODEL_HEADER)?.trim() || undefined;
  const attempts: LlmAttempt[] = [];
  const preferredCandidate =
    routeMode === "manual" && requestedProvider
      ? null
      : resolvePreferredCandidate(options);

  const manualCandidates =
    routeMode === "manual" && requestedProvider
      ? [{ provider: requestedProvider, model: requestedModel }]
      : [];

  const autoCandidates =
    routeMode === "manual"
      ? []
      : parseAutoProviderOrder(Deno.env.get("LLM_AUTO_PROVIDER_ORDER")).map((provider) => ({
          provider,
          model: undefined,
        }));

  const candidates = [
    ...manualCandidates,
    ...(preferredCandidate ? [preferredCandidate] : []),
    ...autoCandidates,
  ];
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => other.provider === candidate.provider) === index,
  );

  let lastError: unknown = null;

  for (let index = 0; index < uniqueCandidates.length; index += 1) {
    const candidate = uniqueCandidates[index];
    if (!isProviderConfigured(candidate.provider)) {
      attempts.push({
        provider: candidate.provider,
        model: getConfiguredModel(candidate.provider, candidate.model),
        status: "skipped",
        detail: "missing_api_key",
      });
      continue;
    }

    const runtime = createProviderRuntime(candidate.provider, candidate.model);

    try {
      const completion = await runtime.client.chat.completions.create({
        ...payload,
        model: runtime.model,
      });
      attempts.push({
        provider: runtime.provider,
        model: runtime.model,
        status: "success",
      });
      return {
        runtime,
        completion,
        routeMode,
        attempts,
      };
    } catch (error) {
      lastError = error;
      attempts.push({
        provider: runtime.provider,
        model: runtime.model,
        status: "error",
        detail: getAttemptDetail(error),
      });

      const hasNextCandidate = index < uniqueCandidates.length - 1;
      if (!hasNextCandidate || !shouldFallbackToNextProvider(error)) {
        break;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("No configured LLM provider is available");
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
  meta: {
    routeMode?: LlmRouteMode;
    attempts?: LlmAttempt[];
  } = {},
  overrides: Record<string, string> = {},
): Headers {
  const headers = new Headers({
    "X-LLM-Provider": runtime.provider,
    "X-LLM-Model": runtime.model,
    "X-LLM-Key-Prefix": runtime.apiKeyPrefix,
    "X-LLM-Route-Mode": meta.routeMode ?? "manual",
    "X-LLM-Attempts": meta.attempts ? formatAttempts(meta.attempts) : "",
    "Access-Control-Expose-Headers":
      "X-LLM-Provider, X-LLM-Model, X-LLM-Key-Prefix, X-LLM-Route-Mode, X-LLM-Attempts",
  });

  for (const [key, value] of Object.entries(overrides)) {
    headers.set(key, value);
  }

  return headers;
}

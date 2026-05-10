/// <reference path="./editor-shims.d.ts" />

// @ts-ignore Deno resolves this remote dependency at runtime.
import OpenAI from "https://esm.sh/openai@4";

export type SupportedLlmProvider = "cerebras" | "together";
export type LlmTaskKey = "suggest" | "review" | "session_recap";

type LlmRuntime = {
  provider: SupportedLlmProvider;
  model: string;
  client: any;
  apiKeyPrefix: string;
};

export type LlmRouteMode = "auto" | "manual";

export type LlmAttempt = {
  provider: SupportedLlmProvider;
  model: string;
  status: "success" | "error" | "skipped";
  detail?: string;
};

type LlmExecutionOptions = {
  taskKey?: LlmTaskKey;
};

const DEFAULT_PROVIDER: SupportedLlmProvider = "cerebras";

const DEFAULT_MODELS: Record<SupportedLlmProvider, string> = {
  cerebras: "gpt-oss-120b",
  together: "Qwen/Qwen3.5-9B",
};

const TASK_MODEL_PROFILES: Record<
  LlmTaskKey,
  Record<SupportedLlmProvider, string>
> = {
  suggest: {
    cerebras: "llama3.1-8b",
    together: "Qwen/Qwen3.5-9B",
  },
  review: {
    cerebras: "gpt-oss-120b",
    together: "openai/gpt-oss-120b",
  },
  session_recap: {
    cerebras: "gpt-oss-120b",
    together: "openai/gpt-oss-120b",
  },
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
  "openai/gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt oss 120b": "openai/gpt-oss-120b",
  "qwen/qwen3.5-9b": "Qwen/Qwen3.5-9B",
  "qwen3.5-9b": "Qwen/Qwen3.5-9B",
};

const REQUEST_ROUTE_MODE_HEADER = "x-llm-route-mode";
const REQUEST_PROVIDER_HEADER = "x-llm-preferred-provider";
const REQUEST_MODEL_HEADER = "x-llm-preferred-model";

const DEFAULT_AUTO_PROVIDER_ORDER: SupportedLlmProvider[] = ["cerebras", "together"];

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

  if (normalized === "cerebras" || normalized === "together") {
    return normalized;
  }

  return DEFAULT_PROVIDER;
}

function parseSupportedProvider(rawProvider: string | undefined): SupportedLlmProvider | null {
  const normalized = rawProvider?.trim().toLowerCase();

  if (normalized === "cerebras" || normalized === "together") {
    return normalized;
  }

  return null;
}

function getProviderApiKeyEnvName(provider: SupportedLlmProvider): string {
  return provider === "cerebras" ? "CEREBRAS_API_KEY" : "TOGETHER_API_KEY";
}

function getConfiguredTaskModel(
  provider: SupportedLlmProvider,
  taskKey?: LlmTaskKey,
): string | undefined {
  if (!taskKey) {
    return undefined;
  }

  return TASK_MODEL_PROFILES[taskKey]?.[provider];
}

function getConfiguredModel(
  provider: SupportedLlmProvider,
  options: {
    rawModelOverride?: string;
    taskKey?: LlmTaskKey;
  } = {},
): string {
  return resolveModel(
    provider,
    options.rawModelOverride ?? getConfiguredTaskModel(provider, options.taskKey),
  );
}

function isProviderConfigured(provider: SupportedLlmProvider): boolean {
  const apiKey = Deno.env.get(getProviderApiKeyEnvName(provider))?.trim();
  return Boolean(apiKey);
}

function parseAutoProviderOrder(rawOrder: string | undefined): SupportedLlmProvider[] {
  const configured = (rawOrder ?? "")
    .split(",")
    .map((value) => parseSupportedProvider(value))
    .filter((provider): provider is SupportedLlmProvider => provider != null);

  const deduped: SupportedLlmProvider[] = [];
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
  options: {
    rawModelOverride?: string;
    taskKey?: LlmTaskKey;
  } = {},
): LlmRuntime {
  const model = getConfiguredModel(provider, options);

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

export async function runLlmChatCompletion<T extends Record<string, unknown>>(
  req: Request | undefined,
  payload: T,
  options: LlmExecutionOptions = {},
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
  const preferredProvider =
    routeMode === "manual" && requestedProvider
      ? requestedProvider
      : normalizeProvider(Deno.env.get("LLM_PROVIDER"));
  const fallbackProviders = parseAutoProviderOrder(Deno.env.get("LLM_AUTO_PROVIDER_ORDER"));
  const orderedProviders = [
    preferredProvider,
    ...fallbackProviders.filter((provider) => provider !== preferredProvider),
  ];
  const candidates = orderedProviders.map((provider, index) => ({
    provider,
    model:
      index === 0 && routeMode === "manual"
        ? requestedModel
        : getConfiguredTaskModel(provider, options.taskKey),
  }));
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
        model: getConfiguredModel(candidate.provider, {
          rawModelOverride: candidate.model,
          taskKey: options.taskKey,
        }),
        status: "skipped",
        detail: "missing_api_key",
      });
      continue;
    }

    const runtime = createProviderRuntime(candidate.provider, {
      rawModelOverride: candidate.model,
      taskKey: options.taskKey,
    });

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

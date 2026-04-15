type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type RequestOptions = {
  label: string;
  url: string;
  method?: RequestMethod;
  headers?: Record<string, string>;
  body?: unknown;
  logSuccess?: boolean;
};

type EdgeFunctionOptions = {
  functionName: string;
  accessToken?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  method?: RequestMethod;
  logSuccess?: boolean;
};

export type RequestResult<T> = {
  data: T;
  status: number;
  headers: Headers;
  requestId: string;
};

export class ApiRequestError extends Error {
  status: number;
  requestId: string;
  label: string;
  url: string;
  body: unknown;

  constructor(args: {
    message: string;
    status: number;
    requestId: string;
    label: string;
    url: string;
    body: unknown;
  }) {
    super(args.message);
    this.name = 'ApiRequestError';
    this.status = args.status;
    this.requestId = args.requestId;
    this.label = args.label;
    this.url = args.url;
    this.body = args.body;
  }
}

function makeRequestId(label: string) {
  return `${label}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function safeSerialize(value: unknown) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return String(value);
  }
}

function parseBodyText(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object') {
    const candidate = body as Record<string, unknown>;
    const message =
      candidate.error_description ??
      candidate.error ??
      candidate.message ??
      candidate.msg;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  return fallback;
}

function formatRequestLog(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

export async function requestJson<T>({
  label,
  url,
  method = 'POST',
  headers = {},
  body,
  logSuccess = false,
}: RequestOptions): Promise<RequestResult<T>> {
  const requestId = makeRequestId(label);
  const startedAt = Date.now();

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const durationMs = Date.now() - startedAt;
  const rawText = await response.text();
  const parsedBody = parseBodyText(rawText);

  if (!response.ok) {
    const baseMessage = getErrorMessage(
      parsedBody,
      `${label} failed with HTTP ${response.status}`,
    );
    const error = new ApiRequestError({
      message: `${baseMessage} (status ${response.status}, request ${requestId})`,
      status: response.status,
      requestId,
      label,
      url,
      body: parsedBody,
    });

    console.error(
      '[ApiRequest] Request failed',
      formatRequestLog({
        requestId,
        label,
        url,
        method,
        status: response.status,
        durationMs,
        body: safeSerialize(parsedBody),
      }),
    );

    throw error;
  }

  if (logSuccess) {
    console.log(
      '[ApiRequest] Request succeeded',
      formatRequestLog({
        requestId,
        label,
        url,
        method,
        status: response.status,
        durationMs,
      }),
    );
  }

  return {
    data: (parsedBody ?? {}) as T,
    status: response.status,
    headers: response.headers,
    requestId,
  };
}

export async function invokeEdgeFunction<T>({
  functionName,
  accessToken,
  body = {},
  headers = {},
  method = 'POST',
  logSuccess = false,
}: EdgeFunctionOptions): Promise<RequestResult<T>> {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

  return requestJson<T>({
    label: `fn:${functionName}`,
    url: `${supabaseUrl}/functions/v1/${functionName}`,
    method,
    logSuccess,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      ...(accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {}),
      ...headers,
    },
    body,
  });
}

export const JSON_HEADERS = { "Content-Type": "application/json" };
export const FEATURE_ACCESS_DENIED_CODE = "feature_access_denied";
export const AUTH_REQUIRED_CODE = "auth_required";

export type FeatureKey = "live_minutes" | "review" | "suggestion";

export type FeatureAccessRow = {
  feature_key: string;
  allowed: boolean;
  reason: string;
  tier: string;
  used_count: number | null;
  remaining_count: number | null;
  limit_count: number | null;
  reset_at: string | null;
};

export type FeatureAccessPayload = {
  feature: FeatureKey;
  allowed: boolean;
  reason: string;
  tier: string;
  used: number | null;
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
};

export function mapFeatureAccessRow(
  feature: FeatureKey,
  row: FeatureAccessRow | null | undefined,
): FeatureAccessPayload {
  return {
    feature,
    allowed: Boolean(row?.allowed),
    reason: row?.reason ?? "unknown",
    tier: row?.tier ?? "unknown",
    used: typeof row?.used_count === "number" ? row.used_count : null,
    remaining:
      typeof row?.remaining_count === "number" ? row.remaining_count : null,
    limit: typeof row?.limit_count === "number" ? row.limit_count : null,
    resetAt: typeof row?.reset_at === "string" ? row.reset_at : null,
  };
}

export function createAuthRequiredAccess(feature: FeatureKey): FeatureAccessPayload {
  return {
    feature,
    allowed: false,
    reason: AUTH_REQUIRED_CODE,
    tier: "unknown",
    used: null,
    remaining: null,
    limit: null,
    resetAt: null,
  };
}

export function createAuthRequiredResponse(feature: FeatureKey) {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      code: AUTH_REQUIRED_CODE,
      access: createAuthRequiredAccess(feature),
    }),
    {
      status: 401,
      headers: JSON_HEADERS,
    },
  );
}

export function createFeatureAccessDeniedResponse(args: {
  access: FeatureAccessPayload;
  error: string;
  status?: number;
  extra?: Record<string, unknown>;
}) {
  return new Response(
    JSON.stringify({
      error: args.error,
      code: FEATURE_ACCESS_DENIED_CODE,
      access: args.access,
      ...args.extra,
    }),
    {
      status: args.status ?? 429,
      headers: JSON_HEADERS,
    },
  );
}

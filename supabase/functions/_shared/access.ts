export const JSON_HEADERS = { "Content-Type": "application/json" };

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

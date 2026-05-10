import type { SubscriptionTier } from '@/shared/store/authStore';

export type FeatureKey = 'live_minutes' | 'review' | 'suggestion';

export type FeatureAccessReason =
  | 'ok'
  | 'limit_reached'
  | 'pro_required'
  | 'auth_required'
  | 'unknown';

export type FeatureAccessCode =
  | 'feature_access_denied'
  | 'auth_required'
  | 'unknown';

export type FeatureAccessSummary = {
  feature: FeatureKey;
  allowed: boolean;
  reason: FeatureAccessReason;
  tier: SubscriptionTier | 'unknown';
  used: number | null;
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
};

export type FeatureAccessEnvelope = {
  code?: string;
  access?: Partial<FeatureAccessSummary> & {
    feature?: string;
    tier?: string;
    reason?: string;
  };
};

export type FeatureAccessRpcRow = {
  feature_key?: string | null;
  allowed?: boolean | null;
  reason?: string | null;
  tier?: string | null;
  used_count?: number | null;
  remaining_count?: number | null;
  limit_count?: number | null;
  reset_at?: string | null;
};

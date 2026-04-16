import type { SubscriptionTier } from '@/shared/store/authStore';

export type FeatureKey = 'live_minutes' | 'review' | 'suggestion';

export type FeatureAccessReason =
  | 'ok'
  | 'limit_reached'
  | 'pro_required'
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
  access?: Partial<FeatureAccessSummary> & {
    feature?: string;
    tier?: string;
    reason?: string;
  };
};

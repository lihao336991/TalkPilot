import { useAccessStore } from '@/features/live/store/accessStore';
import { useSessionStore } from '@/features/live/store/sessionStore';
import { mapFeatureAccessRpcRow } from '@/shared/billing/access';
import { getValidAccessToken, supabase } from '@/shared/api/supabase';
import type { FeatureAccessSummary, FeatureKey } from '@/shared/billing/accessTypes';
import { useAuthStore, type SubscriptionTier } from '@/shared/store/authStore';
import { getOrCreateInstallId } from '@/shared/device/installId';

export function getDailyMinutesLimitForTier(tier: SubscriptionTier) {
  switch (tier) {
    case 'pro':
      return 120;
    case 'unlimited':
      return 99999;
    default:
      return 10;
  }
}

function getSafeDailyMinutesLimit(tier: SubscriptionTier, limit: number | null) {
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0
    ? limit
    : getDailyMinutesLimitForTier(tier);
}

export function applyFeatureAccessSummary(summary: FeatureAccessSummary) {
  useAccessStore.getState().setFeatureAccess(summary);

  if (summary.feature !== 'live_minutes') {
    return;
  }

  const normalizedTier =
    summary.tier === 'free' || summary.tier === 'pro' || summary.tier === 'unlimited'
      ? summary.tier
      : 'free';

  useSessionStore.getState().setUsageSummary({
    minutesUsed: Math.max(0, summary.used ?? 0),
    minutesLimit: getSafeDailyMinutesLimit(normalizedTier, summary.limit),
  });
}

export function syncSubscriptionTierToUsageLimit(tier: SubscriptionTier) {
  useSessionStore
    .getState()
    .setUsageLimit(getDailyMinutesLimitForTier(tier));
}

export function resetLiveAccessState(tier: SubscriptionTier = 'free') {
  useAccessStore.getState().clear();
  useSessionStore.getState().setUsageSummary({
    minutesUsed: 0,
    minutesLimit: getDailyMinutesLimitForTier(tier),
  });
}

async function requireFeatureAccessSummary(
  rpcName: string,
  args: Record<string, unknown>,
  fallbackFeature: FeatureKey,
) {
  await getValidAccessToken();

  const { data, error } = await supabase.rpc(rpcName, args);
  if (error) {
    throw new Error(error.message || `${rpcName} failed.`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const summary = mapFeatureAccessRpcRow(row, fallbackFeature);

  if (!summary) {
    throw new Error(`${rpcName} returned an empty access summary.`);
  }

  applyFeatureAccessSummary(summary);
  return summary;
}

export async function refreshLiveMinutesAccess(userId = useAuthStore.getState().userId) {
  if (!userId) {
    resetLiveAccessState();
    return null;
  }

  const installId = await getOrCreateInstallId();
  return requireFeatureAccessSummary(
    'get_live_minutes_access',
    { p_user_id: userId, p_install_id: installId },
    'live_minutes',
  );
}

export async function consumeLiveSessionAccess(args: {
  sessionId: string;
  durationSeconds: number;
}) {
  const installId = await getOrCreateInstallId();
  return requireFeatureAccessSummary(
    'consume_live_session_access',
    {
      p_session_id: args.sessionId,
      p_duration_seconds: Math.max(0, Math.round(args.durationSeconds)),
      p_install_id: installId,
    },
    'live_minutes',
  );
}

export async function resetFreeAccessDebug() {
  await getValidAccessToken();
  const userId = useAuthStore.getState().userId;
  const installId = await getOrCreateInstallId();

  if (!userId) {
    throw new Error('Cannot reset free access without an active user session.');
  }

  const { error } = await supabase.rpc('reset_free_access_debug', {
    p_install_id: installId,
  });
  if (error) {
    throw new Error(error.message || 'Failed to reset free access.');
  }

  useAccessStore.getState().clear();
  return requireFeatureAccessSummary(
    'get_live_minutes_access',
    { p_user_id: userId, p_install_id: installId },
    'live_minutes',
  );
}

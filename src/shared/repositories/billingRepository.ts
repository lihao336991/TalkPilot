import { useSessionStore } from '@/features/live/store/sessionStore';
import type { SubscriptionTier } from '@/shared/store/authStore';

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

export function syncSubscriptionTierToUsageLimit(tier: SubscriptionTier) {
  useSessionStore
    .getState()
    .setUsageLimit(getDailyMinutesLimitForTier(tier));
}

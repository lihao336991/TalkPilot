import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { Platform } from 'react-native';

import { refreshProfileFromSession } from '@/shared/api/supabase';
import { useAuthStore } from '@/shared/store/authStore';

const PRO_ENTITLEMENT_ID = 'pro';
const MAX_PROFILE_SYNC_ATTEMPTS = 6;
const PROFILE_SYNC_INTERVAL_MS = 1200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getRevenueCatApiKey() {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS ?? '';
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_ANDROID ?? '';
  }

  return '';
}

function hasActiveProEntitlement(customerInfo: CustomerInfo) {
  return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]);
}

class RevenueCatService {
  private configuredAppUserId: string | null = null;
  private customerInfoListenerAttached = false;

  async configureForAuthenticatedUser(appUserId: string) {
    if (!isSupportedPlatform()) {
      return;
    }

    const apiKey = getRevenueCatApiKey().trim();
    if (!apiKey) {
      throw new Error(
        'Missing RevenueCat public SDK key. Set EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS or EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_ANDROID.',
      );
    }

    const isConfigured = await Purchases.isConfigured();

    if (!isConfigured) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      Purchases.configure({
        apiKey,
        appUserID: appUserId,
      });
      this.configuredAppUserId = appUserId;
      this.attachCustomerInfoListener();
      return;
    }

    if (!this.customerInfoListenerAttached) {
      this.attachCustomerInfoListener();
    }

    if (this.configuredAppUserId === appUserId) {
      return;
    }

    await Purchases.logIn(appUserId);
    this.configuredAppUserId = appUserId;
  }

  async getCurrentOffering() {
    if (!isSupportedPlatform()) {
      return null;
    }

    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  }

  async presentPaywallIfNeeded() {
    if (!isSupportedPlatform()) {
      return RevenueCatUI.PAYWALL_RESULT.NOT_PRESENTED;
    }

    return RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
    });
  }

  async syncProfileAfterPurchase(customerInfo?: CustomerInfo) {
    const hasUnlockedPro = customerInfo
      ? hasActiveProEntitlement(customerInfo)
      : false;

    for (let attempt = 0; attempt < MAX_PROFILE_SYNC_ATTEMPTS; attempt += 1) {
      await refreshProfileFromSession();
      const currentTier = useAuthStore.getState().subscriptionTier;
      if (currentTier === 'pro') {
        return { unlocked: true, webhookSynced: true };
      }

      if (!hasUnlockedPro) {
        break;
      }

      await sleep(PROFILE_SYNC_INTERVAL_MS);
    }

    return {
      unlocked: hasUnlockedPro,
      webhookSynced: useAuthStore.getState().subscriptionTier === 'pro',
    };
  }

  async restorePurchases() {
    if (!isSupportedPlatform()) {
      throw new Error('RevenueCat restore is only supported on iOS and Android.');
    }

    const customerInfo = await Purchases.restorePurchases();
    await this.syncProfileAfterPurchase(customerInfo);
    return customerInfo;
  }

  private attachCustomerInfoListener() {
    if (this.customerInfoListenerAttached) {
      return;
    }

    Purchases.addCustomerInfoUpdateListener(() => {
      void refreshProfileFromSession().catch((error) => {
        console.error('[RevenueCat] Failed to refresh profile after customer info update:', error);
      });
    });
    this.customerInfoListenerAttached = true;
  }
}

export const revenueCatService = new RevenueCatService();

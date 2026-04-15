import { Platform } from 'react-native';
import Purchases, {
    LOG_LEVEL,
    type CustomerInfo,
    type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import {
  reconcileRevenueCatCustomer,
  refreshProfileFromSession,
} from '@/shared/api/supabase';
import { syncSubscriptionTierToUsageLimit } from '@/shared/repositories/billingRepository';
import { useAuthStore, type SubscriptionTier } from '@/shared/store/authStore';

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

function getActiveEntitlement(customerInfo: CustomerInfo) {
  const exactMatch = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  if (exactMatch) {
    return exactMatch;
  }

  const activeEntitlements = Object.values(customerInfo.entitlements.active);
  return activeEntitlements[0] ?? null;
}

function hasActiveSubscriptionProduct(customerInfo: CustomerInfo) {
  return customerInfo.activeSubscriptions.length > 0;
}

function hasActiveProEntitlement(customerInfo: CustomerInfo) {
  return Boolean(getActiveEntitlement(customerInfo)) || hasActiveSubscriptionProduct(customerInfo);
}

function hasPaidAccess(tier: SubscriptionTier) {
  return tier === 'pro' || tier === 'unlimited';
}

function getProEntitlementExpiration(customerInfo: CustomerInfo) {
  const entitlement = getActiveEntitlement(customerInfo);
  return entitlement?.expirationDate ?? null;
}

export type BillingSyncSummary = {
  unlocked: boolean;
  webhookSynced: boolean;
};

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
      const customerInfo = await this.refreshCustomerInfoState();
      await this.reconcileIfNeeded(customerInfo);
      return;
    }

    if (!this.customerInfoListenerAttached) {
      this.attachCustomerInfoListener();
    }

    if (this.configuredAppUserId === appUserId) {
      const customerInfo = await this.refreshCustomerInfoState();
      await this.reconcileIfNeeded(customerInfo);
      return;
    }

    await Purchases.logIn(appUserId);
    this.configuredAppUserId = appUserId;
    const customerInfo = await this.refreshCustomerInfoState();
    await this.reconcileIfNeeded(customerInfo);
  }

  async getCurrentOffering() {
    if (!isSupportedPlatform()) {
      return null;
    }

    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  }

  async purchasePackage(selectedPackage: PurchasesPackage) {
    if (!isSupportedPlatform()) {
      throw new Error('RevenueCat purchase is only supported on iOS and Android.');
    }

    const result = await Purchases.purchasePackage(selectedPackage);
    const summary = await this.syncProfileAfterPurchase(result.customerInfo);
    return {
      customerInfo: result.customerInfo,
      summary,
    };
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

  async syncProfileAfterPurchase(customerInfo?: CustomerInfo): Promise<BillingSyncSummary> {
    const resolvedCustomerInfo = customerInfo ?? (await Purchases.getCustomerInfo());
    const hasUnlockedPro = this.applyCustomerInfoToStore(resolvedCustomerInfo);

    if (hasUnlockedPro) {
      try {
        await reconcileRevenueCatCustomer();
      } catch (error) {
        console.error('[RevenueCat] Failed to reconcile subscription to Supabase:', error);
      }
    }

    for (let attempt = 0; attempt < MAX_PROFILE_SYNC_ATTEMPTS; attempt += 1) {
      await refreshProfileFromSession();
      const authState = useAuthStore.getState();
      if (
        hasPaidAccess(authState.subscriptionTier) &&
        authState.subscriptionSyncState === 'synced'
      ) {
        return { unlocked: true, webhookSynced: true };
      }

      if (!hasUnlockedPro) {
        break;
      }

      await sleep(PROFILE_SYNC_INTERVAL_MS);
    }

    return {
      unlocked: hasPaidAccess(useAuthStore.getState().subscriptionTier),
      webhookSynced: useAuthStore.getState().subscriptionSyncState === 'synced',
    };
  }

  async restorePurchases() {
    if (!isSupportedPlatform()) {
      throw new Error('RevenueCat restore is only supported on iOS and Android.');
    }

    const customerInfo = await Purchases.restorePurchases();
    const summary = await this.syncProfileAfterPurchase(customerInfo);
    return {
      customerInfo,
      summary,
    };
  }

  private attachCustomerInfoListener() {
    if (this.customerInfoListenerAttached) {
      return;
    }

    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const hasPro = this.applyCustomerInfoToStore(customerInfo);
      if (hasPro || useAuthStore.getState().subscriptionSyncState === 'syncing') {
        void this.reconcileIfNeeded(customerInfo);
      }
      void refreshProfileFromSession().catch((error) => {
        console.error('[RevenueCat] Failed to refresh profile after customer info update:', error);
      });
    });
    this.customerInfoListenerAttached = true;
  }

  private applyCustomerInfoToStore(customerInfo: CustomerInfo) {
    const hasPro = hasActiveProEntitlement(customerInfo);

    useAuthStore.getState().setRevenueCatEntitlement({
      hasPro,
      expiresAt: hasPro ? getProEntitlementExpiration(customerInfo) : null,
      revenuecatAppUserId: this.configuredAppUserId,
    });
    syncSubscriptionTierToUsageLimit(useAuthStore.getState().subscriptionTier);

    return hasPro;
  }

  private async refreshCustomerInfoState() {
    const customerInfo = await Purchases.getCustomerInfo();
    this.applyCustomerInfoToStore(customerInfo);
    return customerInfo;
  }

  private async reconcileIfNeeded(customerInfo: CustomerInfo) {
    const shouldReconcile =
      hasActiveProEntitlement(customerInfo) ||
      useAuthStore.getState().subscriptionSyncState === 'syncing';

    if (!shouldReconcile) {
      return;
    }

    try {
      await reconcileRevenueCatCustomer();
    } catch (error) {
      console.error('[RevenueCat] Failed to reconcile customer state:', error);
    }
  }
}

export const revenueCatService = new RevenueCatService();

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
import { logBillingEvent } from '@/shared/billing/logger';
import { syncSubscriptionTierToUsageLimit } from '@/shared/repositories/billingRepository';
import {
    getBillingStateSnapshot,
    useAuthStore,
    type SubscriptionTier,
} from '@/shared/store/authStore';

const PRO_ENTITLEMENT_ID = 'pro';
const MAX_PROFILE_SYNC_ATTEMPTS = 6;
const PROFILE_SYNC_INTERVAL_MS = 1200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPurchaseCancelledError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    userCancelled?: boolean;
    message?: string;
  };

  if (candidate.userCancelled) {
    return true;
  }

  return typeof candidate.message === 'string'
    ? candidate.message.toLowerCase().includes('cancel')
    : false;
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

function getCustomerInfoSummary(customerInfo: CustomerInfo) {
  return {
    activeEntitlementIds: Object.keys(customerInfo.entitlements.active),
    activeSubscriptions: [...customerInfo.activeSubscriptions],
    latestExpirationDate: getProEntitlementExpiration(customerInfo),
    hasActiveProEntitlement: hasActiveProEntitlement(customerInfo),
  };
}

class RevenueCatService {
  private configuredAppUserId: string | null = null;
  private customerInfoListenerAttached = false;

  async configureForAuthenticatedUser(appUserId: string) {
    if (!isSupportedPlatform()) {
      logBillingEvent('revenuecat_configure_skipped', {
        reason: 'unsupported_platform',
        platform: Platform.OS,
      });
      return;
    }

    const apiKey = getRevenueCatApiKey().trim();
    if (!apiKey) {
      throw new Error(
        'Missing RevenueCat public SDK key. Set EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS or EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_ANDROID.',
      );
    }

    logBillingEvent('revenuecat_configure_started', {
      appUserId,
      platform: Platform.OS,
      alreadyConfiguredAppUserId: this.configuredAppUserId,
    });

    const isConfigured = await Purchases.isConfigured();

    if (!isConfigured) {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.WARN);
      }

      Purchases.configure({
        apiKey,
        appUserID: appUserId,
      });
      this.configuredAppUserId = appUserId;
      this.attachCustomerInfoListener();
      const customerInfo = await this.refreshCustomerInfoState();
      await this.reconcileIfNeeded(customerInfo);
      logBillingEvent('revenuecat_configure_completed', {
        appUserId,
        mode: 'initial_configure',
        customerInfo: getCustomerInfoSummary(customerInfo),
        ...getBillingStateSnapshot(useAuthStore.getState()),
      });
      return;
    }

    if (!this.customerInfoListenerAttached) {
      this.attachCustomerInfoListener();
    }

    if (this.configuredAppUserId === appUserId) {
      const customerInfo = await this.refreshCustomerInfoState();
      await this.reconcileIfNeeded(customerInfo);
      logBillingEvent('revenuecat_configure_completed', {
        appUserId,
        mode: 'reuse_existing_user',
        customerInfo: getCustomerInfoSummary(customerInfo),
        ...getBillingStateSnapshot(useAuthStore.getState()),
      });
      return;
    }

    await Purchases.logIn(appUserId);
    this.configuredAppUserId = appUserId;
    const customerInfo = await this.refreshCustomerInfoState();
    await this.reconcileIfNeeded(customerInfo);
    logBillingEvent('revenuecat_configure_completed', {
      appUserId,
      mode: 'login_switch_user',
      customerInfo: getCustomerInfoSummary(customerInfo),
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });
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

    logBillingEvent('purchase_started', {
      packageIdentifier: selectedPackage.identifier,
      productIdentifier: selectedPackage.product.identifier,
      priceString: selectedPackage.product.priceString,
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });

    try {
      const result = await Purchases.purchasePackage(selectedPackage);
      const summary = await this.syncProfileAfterPurchase(result.customerInfo);
      logBillingEvent('purchase_succeeded', {
        packageIdentifier: selectedPackage.identifier,
        productIdentifier: selectedPackage.product.identifier,
        summary,
        customerInfo: getCustomerInfoSummary(result.customerInfo),
        ...getBillingStateSnapshot(useAuthStore.getState()),
      });
      return {
        customerInfo: result.customerInfo,
        summary,
      };
    } catch (error) {
      if (isPurchaseCancelledError(error)) {
        logBillingEvent('purchase_cancelled', {
          packageIdentifier: selectedPackage.identifier,
          productIdentifier: selectedPackage.product.identifier,
          ...getBillingStateSnapshot(useAuthStore.getState()),
        });
        throw error;
      }
      logBillingEvent(
        'purchase_failed',
        {
          packageIdentifier: selectedPackage.identifier,
          productIdentifier: selectedPackage.product.identifier,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
          ...getBillingStateSnapshot(useAuthStore.getState()),
        },
        'error',
      );
      throw error;
    }
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
    logBillingEvent('post_purchase_sync_started', {
      customerInfo: getCustomerInfoSummary(resolvedCustomerInfo),
      hasUnlockedPro,
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });

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
        logBillingEvent('post_purchase_sync_completed', {
          attempts: attempt + 1,
          result: { unlocked: true, webhookSynced: true },
          ...getBillingStateSnapshot(authState),
        });
        return { unlocked: true, webhookSynced: true };
      }

      if (!hasUnlockedPro) {
        break;
      }

      await sleep(PROFILE_SYNC_INTERVAL_MS);
    }

    const finalSummary = {
      unlocked: hasPaidAccess(useAuthStore.getState().subscriptionTier),
      webhookSynced: useAuthStore.getState().subscriptionSyncState === 'synced',
    };
    logBillingEvent('post_purchase_sync_completed', {
      attempts: MAX_PROFILE_SYNC_ATTEMPTS,
      result: finalSummary,
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });

    return finalSummary;
  }

  async restorePurchases() {
    if (!isSupportedPlatform()) {
      throw new Error('RevenueCat restore is only supported on iOS and Android.');
    }

    logBillingEvent('restore_started', {
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });

    try {
      const customerInfo = await Purchases.restorePurchases();
      const summary = await this.syncProfileAfterPurchase(customerInfo);
      logBillingEvent('restore_succeeded', {
        summary,
        customerInfo: getCustomerInfoSummary(customerInfo),
        ...getBillingStateSnapshot(useAuthStore.getState()),
      });
      return {
        customerInfo,
        summary,
      };
    } catch (error) {
      if (isPurchaseCancelledError(error)) {
        logBillingEvent('restore_cancelled', {
          ...getBillingStateSnapshot(useAuthStore.getState()),
        });
        throw error;
      }
      logBillingEvent(
        'restore_failed',
        {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
          ...getBillingStateSnapshot(useAuthStore.getState()),
        },
        'error',
      );
      throw error;
    }
  }

  private attachCustomerInfoListener() {
    if (this.customerInfoListenerAttached) {
      return;
    }

    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      logBillingEvent('customer_info_updated', {
        customerInfo: getCustomerInfoSummary(customerInfo),
      });
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
    logBillingEvent('customer_info_applied_to_store', {
      customerInfo: getCustomerInfoSummary(customerInfo),
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });

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

    logBillingEvent('reconcile_evaluated', {
      shouldReconcile,
      customerInfo: getCustomerInfoSummary(customerInfo),
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });

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

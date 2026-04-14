import { refreshProfileFromSession } from '@/shared/api/supabase';
import { useAuthStore } from '@/shared/store/authStore';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { revenueCatService } from '../services/RevenueCatService';

function getPurchaseSummaryMessage(args: {
  unlocked: boolean;
  webhookSynced: boolean;
}) {
  if (args.unlocked && args.webhookSynced) {
    return 'Purchase completed and Pro access is now synced.';
  }

  if (args.unlocked) {
    return 'Purchase succeeded. RevenueCat is active, and Supabase entitlement sync is still catching up.';
  }

  return 'Purchase flow completed, but Pro entitlement is not active yet.';
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authMode = useAuthStore((state) => state.authMode);
  const userId = useAuthStore((state) => state.userId);
  const subscriptionTier = useAuthStore((state) => state.subscriptionTier);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const closeScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  }, [router]);

  useEffect(() => {
    if (authMode !== 'authenticated' || !userId) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await revenueCatService.configureForAuthenticatedUser(userId);
        const currentOffering = await revenueCatService.getCurrentOffering();
        if (!cancelled) {
          setOffering(currentOffering);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load paywall.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authMode, router, userId]);

  useEffect(() => {
    if (subscriptionTier === 'pro') {
      setStatusMessage('Your account already has Pro access.');
    }
  }, [subscriptionTier]);

  async function handleRestorePress() {
    if (!userId) {
      router.replace('/login');
      return;
    }

    try {
      setStatusMessage('Restoring purchases...');
      await revenueCatService.configureForAuthenticatedUser(userId);
      const customerInfo = await revenueCatService.restorePurchases();
      const hasPro = Boolean(customerInfo.entitlements.active.pro);
      setStatusMessage(
        hasPro
          ? 'Restore completed. Syncing Pro access to your account.'
          : 'Restore completed. No active Pro subscription was found.',
      );
      await refreshProfileFromSession();
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error ? error.message : 'Please try again later.',
      );
      setStatusMessage(null);
    }
  }

  async function handlePurchaseCompleted(customerInfo: CustomerInfo) {
    const summary = await revenueCatService.syncProfileAfterPurchase(customerInfo);
    const message = getPurchaseSummaryMessage(summary);
    setStatusMessage(message);

    if (summary.unlocked) {
      Alert.alert('Pro unlocked', message, [
        {
          text: 'Continue',
          onPress: closeScreen,
        },
      ]);
    }
  }

  if (Platform.OS === 'web') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.unsupportedContainer}>
          <Text style={styles.unsupportedTitle}>Purchases are not available on web</Text>
          <Text style={styles.unsupportedBody}>
            Open the iOS or Android development build to test RevenueCat paywalls.
          </Text>
          <Pressable onPress={closeScreen} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />

      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) + 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
            onPress={closeScreen}
            style={styles.iconButton}>
            <Feather name="x" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TalkPilot Pro</Text>
            <Text style={styles.title}>Unlock more conversation time</Text>
            <Text style={styles.subtitle}>
              Subscribe with RevenueCat paywalls. Purchase is bound to your logged-in account.
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading paywall...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>Paywall unavailable</Text>
              <Text style={styles.messageBody}>{errorMessage}</Text>
            </View>
          ) : offering ? (
            <View style={styles.paywallContainer}>
              <RevenueCatUI.Paywall
                options={{
                  offering,
                  displayCloseButton: false,
                }}
                onPurchaseCompleted={({ customerInfo }) => {
                  void handlePurchaseCompleted(customerInfo);
                }}
                onPurchaseCancelled={() => {
                  setStatusMessage('Purchase cancelled.');
                }}
                onPurchaseError={({ error }) => {
                  setStatusMessage(null);
                  Alert.alert(
                    'Purchase failed',
                    error.message || 'Please try again in a moment.',
                  );
                }}
                onRestoreCompleted={({ customerInfo }) => {
                  void handlePurchaseCompleted(customerInfo);
                }}
                onRestoreError={({ error }) => {
                  Alert.alert(
                    'Restore failed',
                    error.message || 'Please try again in a moment.',
                  );
                }}
                onDismiss={closeScreen}
              />
            </View>
          ) : (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>No offering configured</Text>
              <Text style={styles.messageBody}>
                RevenueCat did not return a current offering. Check your default offering in the dashboard.
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            {statusMessage ? (
              <Text style={styles.statusText}>{statusMessage}</Text>
            ) : null}

            <View style={styles.footerActions}>
              <Pressable onPress={handleRestorePress} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Restore purchases</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/customer-center')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Manage subscription</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  unsupportedContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#050505',
    gap: 16,
  },
  unsupportedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unsupportedBody: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  header: {
    paddingHorizontal: 20,
    gap: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCopy: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#8EC5FF',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.68)',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  loadingCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
  messageCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 24,
    padding: 24,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
  },
  paywallContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D6E8FF',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#050505',
  },
});

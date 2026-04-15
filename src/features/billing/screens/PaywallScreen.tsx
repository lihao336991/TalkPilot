import { useAuthStore } from "@/shared/store/authStore";
import { Feather } from "@expo/vector-icons";
import { type Href, Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type BillingSyncSummary,
  revenueCatService,
} from "../services/RevenueCatService";

function getPackageRawLabel(pkg: PurchasesPackage) {
  return `${pkg.packageType}:${pkg.identifier}`.toLowerCase();
}

function getPackagePeriodLabel(pkg: PurchasesPackage) {
  const raw = getPackageRawLabel(pkg);
  if (raw.includes("annual") || raw.includes("year")) {
    return "per year";
  }
  if (raw.includes("monthly") || raw.includes("month")) {
    return "per month";
  }
  if (raw.includes("week")) {
    return "per week";
  }
  return "subscription";
}

function getPackageCycleText(pkg: PurchasesPackage) {
  const raw = getPackageRawLabel(pkg);
  if (raw.includes("annual") || raw.includes("year")) {
    return "Annual billing";
  }
  if (raw.includes("monthly") || raw.includes("month")) {
    return "Monthly billing";
  }
  if (raw.includes("week")) {
    return "Weekly billing";
  }
  return "Recurring billing";
}

function getPackageMonths(pkg: PurchasesPackage) {
  const raw = getPackageRawLabel(pkg);
  if (raw.includes("annual") || raw.includes("year")) return 12;
  if (raw.includes("monthly") || raw.includes("month")) return 1;
  return null;
}

function getProductPriceNumber(pkg: PurchasesPackage) {
  const maybePrice = (pkg.product as unknown as { price?: unknown }).price;
  return typeof maybePrice === "number" && Number.isFinite(maybePrice)
    ? maybePrice
    : null;
}

function getMonthlyEquivalentPrice(pkg: PurchasesPackage) {
  const months = getPackageMonths(pkg);
  const price = getProductPriceNumber(pkg);
  if (!months || !price || months <= 1) {
    return null;
  }

  return price / months;
}

function formatPriceValue(value: number, pkg: PurchasesPackage) {
  const currencyCode = (pkg.product as unknown as { currencyCode?: unknown })
    .currencyCode;

  if (typeof currencyCode === "string" && currencyCode.length > 0) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      }).format(value);
    } catch {
      return value.toFixed(value % 1 === 0 ? 0 : 2);
    }
  }

  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function getSavingsSummary(
  packages: PurchasesPackage[],
  selected: PurchasesPackage | null,
) {
  if (!selected) return null;

  const selectedMonths = getPackageMonths(selected);
  const selectedPrice = getProductPriceNumber(selected);
  if (!selectedMonths || !selectedPrice || selectedMonths <= 1) {
    return null;
  }

  const monthlyPlan = packages.find((pkg) => getPackageMonths(pkg) === 1);
  const monthlyPrice = monthlyPlan ? getProductPriceNumber(monthlyPlan) : null;

  if (!monthlyPrice) {
    return null;
  }

  const fullYearAtMonthlyRate = monthlyPrice * selectedMonths;
  const savingsValue = fullYearAtMonthlyRate - selectedPrice;
  if (savingsValue <= 0) {
    return null;
  }

  const savingsPercent = Math.round(
    (savingsValue / fullYearAtMonthlyRate) * 100,
  );
  return {
    percent: savingsPercent,
    absolute: formatPriceValue(savingsValue, selected),
  };
}

function getPurchaseSummaryMessage(args: {
  unlocked: boolean;
  webhookSynced: boolean;
}) {
  if (args.unlocked && args.webhookSynced) {
    return "Purchase completed and Pro access is now synced.";
  }

  if (args.unlocked) {
    return "Purchase succeeded. RevenueCat is active, and Supabase entitlement sync is still catching up.";
  }

  return "Purchase flow completed, but Pro entitlement is not active yet.";
}

function hasPaidAccess(subscriptionTier: "free" | "pro" | "unlimited") {
  return subscriptionTier === "pro" || subscriptionTier === "unlimited";
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authMode = useAuthStore((state) => state.authMode);
  const userId = useAuthStore((state) => state.userId);
  const subscriptionSyncState = useAuthStore(
    (state) => state.subscriptionSyncState,
  );
  const subscriptionTier = useAuthStore((state) => state.subscriptionTier);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const closeScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/profile");
    }
  }, [router]);

  const packages = useMemo(() => {
    const availablePackages = offering?.availablePackages ?? [];
    return [...availablePackages].sort((left, right) => {
      const leftId = `${left.packageType}:${left.identifier}`.toLowerCase();
      const rightId = `${right.packageType}:${right.identifier}`.toLowerCase();
      if (leftId.includes("annual") || leftId.includes("year")) return -1;
      if (rightId.includes("annual") || rightId.includes("year")) return 1;
      return leftId.localeCompare(rightId);
    });
  }, [offering]);

  const selectedPackage =
    packages.find((pkg) => pkg.identifier === selectedPackageId) ??
    packages[0] ??
    null;

  const selectedCtaLabel = selectedPackage
    ? `Continue for ${selectedPackage.product.priceString}`
    : "Choose a plan";
  const isPaidUser = hasPaidAccess(subscriptionTier);

  useEffect(() => {
    if (authMode !== "authenticated" || !userId) {
      router.replace("/login");
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
          setSelectedPackageId(
            currentOffering?.availablePackages?.[0]?.identifier ?? null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load paywall.",
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
    if (isPaidUser) {
      setStatusMessage(
        subscriptionSyncState === "syncing"
          ? "Pro access is active. Supabase cache is syncing..."
          : "Your account already has Pro access.",
      );
    }
  }, [isPaidUser, subscriptionSyncState]);

  async function handleRestorePress() {
    if (!userId) {
      router.replace("/login");
      return;
    }

    try {
      setIsRestoring(true);
      setStatusMessage("Restoring purchases...");
      await revenueCatService.configureForAuthenticatedUser(userId);
      const restoreResult = await revenueCatService.restorePurchases();
      setStatusMessage(getPurchaseSummaryMessage(restoreResult.summary));
    } catch (error) {
      Alert.alert(
        "Restore failed",
        error instanceof Error ? error.message : "Please try again later.",
      );
      setStatusMessage(null);
    } finally {
      setIsRestoring(false);
    }
  }

  async function handlePurchaseCompleted(summary: BillingSyncSummary) {
    const message = getPurchaseSummaryMessage(summary);
    setStatusMessage(message);

    if (summary.unlocked) {
      Alert.alert("Pro unlocked", message, [
        {
          text: "Continue",
          onPress: closeScreen,
        },
      ]);
    }
  }

  function getPackageTitle(pkg: PurchasesPackage) {
    const raw = getPackageRawLabel(pkg);
    if (raw.includes("annual") || raw.includes("year")) {
      return "Yearly Pro";
    }
    if (raw.includes("monthly") || raw.includes("month")) {
      return "Monthly Pro";
    }
    return pkg.product.title || "Pro Plan";
  }

  function getPackageCaption(pkg: PurchasesPackage) {
    const raw = getPackageRawLabel(pkg);
    if (raw.includes("annual") || raw.includes("year")) {
      return "Best value";
    }
    if (raw.includes("monthly") || raw.includes("month")) {
      return "Most flexible";
    }
    return "Premium access";
  }

  function getPackageBadge(pkg: PurchasesPackage) {
    const raw = getPackageRawLabel(pkg);
    if (raw.includes("annual") || raw.includes("year")) {
      return "Best Value";
    }
    if (raw.includes("monthly") || raw.includes("month")) {
      return "Most Flexible";
    }
    return null;
  }

  async function handlePurchasePress() {
    if (!selectedPackage) {
      return;
    }

    try {
      setIsPurchasing(true);
      setStatusMessage(`Purchasing ${getPackageTitle(selectedPackage)}...`);
      await revenueCatService.configureForAuthenticatedUser(userId!);
      const purchaseResult =
        await revenueCatService.purchasePackage(selectedPackage);
      await handlePurchaseCompleted(purchaseResult.summary);
    } catch (error) {
      const maybePurchaseError = error as {
        userCancelled?: boolean;
        message?: string;
      };
      if (maybePurchaseError?.userCancelled) {
        setStatusMessage("Purchase cancelled.");
        return;
      }

      setStatusMessage(null);
      Alert.alert(
        "Purchase failed",
        error instanceof Error
          ? error.message
          : "Please try again in a moment.",
      );
    } finally {
      setIsPurchasing(false);
    }
  }

  if (Platform.OS === "web") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.unsupportedContainer}>
          <Text style={styles.unsupportedTitle}>
            Purchases are not available on web
          </Text>
          <Text style={styles.unsupportedBody}>
            Open the iOS or Android development build to test RevenueCat
            paywalls.
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
          presentation: "card",
          animation: "slide_from_right",
          gestureEnabled: true,
        }}
      />

      <View style={styles.container}>
        <View
          style={[styles.header, { paddingTop: Math.max(insets.top, 18) + 4 }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
            onPress={closeScreen}
            style={styles.iconButton}
          >
            <Feather name="x" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TalkPilot Pro</Text>
            <Text style={styles.title}>Choose your plan</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading paywall...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>Paywall unavailable</Text>
              <Text style={styles.messageBody}>{errorMessage}</Text>
              <Pressable
                onPress={() => {
                  setIsLoading(true);
                  setErrorMessage(null);
                  setOffering(null);
                  setSelectedPackageId(null);
                  void revenueCatService
                    .configureForAuthenticatedUser(userId!)
                    .then(() => revenueCatService.getCurrentOffering())
                    .then((currentOffering) => {
                      setOffering(currentOffering);
                      setSelectedPackageId(
                        currentOffering?.availablePackages?.[0]?.identifier ??
                          null,
                      );
                    })
                    .catch((error) => {
                      setErrorMessage(
                        error instanceof Error
                          ? error.message
                          : "Failed to refresh paywall.",
                      );
                    })
                    .finally(() => {
                      setIsLoading(false);
                    });
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : offering && packages.length > 0 ? (
            <>
              <View style={styles.plansSection}>
                <Text style={styles.sectionTitle}>Plans</Text>
                <View style={styles.packageList}>
                  {packages.map((pkg) => {
                    const selected =
                      selectedPackage?.identifier === pkg.identifier;
                    const badge = getPackageBadge(pkg);
                    const pkgMonthlyEquivalent = getMonthlyEquivalentPrice(pkg);
                    const pkgSavings = getSavingsSummary(packages, pkg);

                    return (
                      <Pressable
                        key={pkg.identifier}
                        accessibilityRole="button"
                        onPress={() => setSelectedPackageId(pkg.identifier)}
                        style={[
                          styles.packageCard,
                          selected && styles.packageCardSelected,
                        ]}
                      >
                        <View style={styles.packageHeader}>
                          <View style={styles.packageCopy}>
                            <Text style={styles.packageTitle}>
                              {getPackageTitle(pkg)}
                            </Text>
                            <Text style={styles.packageCaption}>
                              {getPackageCaption(pkg)}
                            </Text>
                          </View>
                          {pkgSavings ? (
                            <View style={styles.packageBadge}>
                              <Text style={styles.packageBadgeText}>
                                Save {pkgSavings.percent}%
                              </Text>
                            </View>
                          ) : badge ? (
                            <View style={styles.packageBadge}>
                              <Text style={styles.packageBadgeText}>
                                {badge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.packageFooter}>
                          <Text style={styles.packagePrice}>
                            {pkg.product.priceString}
                          </Text>
                          <Text style={styles.packageMeta}>
                            {getPackagePeriodLabel(pkg)}
                          </Text>
                          {selected ? (
                            <View style={styles.packagePills}>
                              <View style={styles.packagePill}>
                                <Text style={styles.packagePillText}>
                                  {getPackageCycleText(pkg)}
                                </Text>
                              </View>
                              {pkgMonthlyEquivalent ? (
                                <View style={styles.packagePill}>
                                  <Text style={styles.packagePillText}>
                                    {formatPriceValue(
                                      pkgMonthlyEquivalent,
                                      pkg,
                                    )}{" "}
                                    / month
                                  </Text>
                                </View>
                              ) : null}
                              {pkgSavings ? (
                                <View style={styles.packagePill}>
                                  <Text style={styles.packagePillText}>
                                    Save {pkgSavings.absolute}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.benefitsCard}>
                <Text style={styles.sectionTitle}>Pro details</Text>
                {[
                  "More speaking minutes every day",
                  "Deeper AI review and coaching feedback",
                  "Purchase restore and account sync",
                ].map((item) => (
                  <View key={item} style={styles.benefitRow}>
                    <View style={styles.benefitDot} />
                    <Text style={styles.benefitText}>{item}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.policyCard}>
                <Text style={styles.sectionTitle}>Terms & support</Text>
                <Text style={styles.policyText}>
                  Subscription renews automatically unless cancelled at least 24
                  hours before the current period ends.
                </Text>
                <View style={styles.inlineActions}>
                  <Pressable
                    onPress={() => router.push("/terms" as Href)}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>Terms</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/privacy" as Href)}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>Privacy</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>No offering configured</Text>
              <Text style={styles.messageBody}>
                RevenueCat did not return a current offering. Check your default
                offering in the dashboard.
              </Text>
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 20), paddingTop: 16 },
          ]}
        >
          {statusMessage ? (
            <Text style={styles.statusText}>{statusMessage}</Text>
          ) : null}

          <Pressable
            disabled={!selectedPackage || isPurchasing || isPaidUser}
            onPress={() => {
              void handlePurchasePress();
            }}
            style={[
              styles.primaryButton,
              (!selectedPackage || isPurchasing || isPaidUser) &&
                styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isPaidUser
                ? subscriptionSyncState === "syncing"
                  ? "Pro active, syncing..."
                  : "You already have Pro"
                : isPurchasing
                  ? "Processing purchase..."
                  : selectedCtaLabel}
            </Text>
          </Pressable>

          <View style={styles.footerActions}>
            <Pressable
              disabled={isRestoring}
              onPress={() => {
                void handleRestorePress();
              }}
              style={styles.footerTextButton}
            >
              <Text style={styles.footerTextButtonLabel}>
                {isRestoring ? "Restoring..." : "Restore Purchases"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/customer-center" as Href)}
              style={styles.footerTextButton}
            >
              <Text style={styles.footerTextButtonLabel}>
                Manage Subscription
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  unsupportedContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: "#050505",
    gap: 16,
  },
  unsupportedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  unsupportedBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.7)",
  },
  header: {
    paddingHorizontal: 20,
    gap: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerCopy: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#8EC5FF",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  loadingCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },
  messageCard: {
    borderRadius: 24,
    padding: 24,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.72)",
  },
  retryButton: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#050505",
  },
  benefitsCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    backgroundColor: "#D2F45C",
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.78)",
  },
  plansSection: {
    gap: 12,
  },
  packageList: {
    gap: 12,
  },
  packageCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 16,
  },
  packageCardSelected: {
    borderColor: "#D2F45C",
    backgroundColor: "rgba(210,244,92,0.12)",
  },
  packageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  packageCopy: {
    flex: 1,
    gap: 4,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  packageCaption: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.68)",
  },
  packageBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#D2F45C",
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#050505",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  packageFooter: {
    gap: 4,
  },
  packagePills: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  packagePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  packagePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  packagePrice: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  packageMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.56)",
  },
  policyCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  policyText: {
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.68)",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
  },
  inlineActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inlineActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footer: {
    paddingHorizontal: 20,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(5,5,5,0.98)",
  },
  statusText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#D6E8FF",
  },
  footerActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  footerTextButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  footerTextButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.64)",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D2F45C",
    paddingHorizontal: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#050505",
  },
});

import { refreshProfileFromSession } from "@/shared/api/supabase";
import { useAuthStore } from "@/shared/store/authStore";
import { Feather } from "@expo/vector-icons";
import { type Href, Stack, useFocusEffect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

import { legalContent } from "../legal/legalContent";
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
    return "periodYear";
  }
  if (raw.includes("monthly") || raw.includes("month")) {
    return "periodMonth";
  }
  if (raw.includes("week")) {
    return "periodWeek";
  }
  return "periodSubscription";
}

function getPackageCycleTextKey(pkg: PurchasesPackage) {
  const raw = getPackageRawLabel(pkg);
  if (raw.includes("annual") || raw.includes("year")) {
    return "cycleAnnual";
  }
  if (raw.includes("monthly") || raw.includes("month")) {
    return "cycleMonthly";
  }
  if (raw.includes("week")) {
    return "cycleWeekly";
  }
  return "cycleRecurring";
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

function formatPriceValue(
  value: number,
  pkg: PurchasesPackage,
  locale: string,
) {
  const currencyCode = (pkg.product as unknown as { currencyCode?: unknown })
    .currencyCode;

  if (typeof currencyCode === "string" && currencyCode.length > 0) {
    try {
      return new Intl.NumberFormat(locale, {
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
    absoluteValue: savingsValue,
  };
}

function getPurchaseSummaryMessage(
  args: {
    unlocked: boolean;
    webhookSynced: boolean;
  },
  t: TFunction,
) {
  if (args.unlocked && args.webhookSynced) {
    return t("billing.paywall.summary.purchaseReady");
  }

  if (args.unlocked) {
    return t("billing.paywall.summary.purchaseSyncing");
  }

  return t("billing.paywall.summary.purchaseDelayed");
}

function getRestoreSummaryMessage(
  args: {
    unlocked: boolean;
    webhookSynced: boolean;
  },
  t: TFunction,
) {
  if (args.unlocked && args.webhookSynced) {
    return t("billing.paywall.summary.restoreReady");
  }

  if (args.unlocked) {
    return t("billing.paywall.summary.restoreSyncing");
  }

  return t("billing.paywall.summary.restoreMissing");
}

function hasPaidAccess(subscriptionTier: "free" | "pro" | "unlimited") {
  return subscriptionTier === "pro" || subscriptionTier === "unlimited";
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
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
  const hasFocusedOnceRef = useRef(false);

  const goToProfile = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.navigate("/(tabs)/profile");
  }, [router]);

  const closeScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      goToProfile();
    }
  }, [goToProfile, router]);

  const packages = useMemo(() => {
    const availablePackages = offering?.availablePackages ?? [];
    return [...availablePackages].sort((left, right) => {
      const leftMonths = getPackageMonths(left);
      const rightMonths = getPackageMonths(right);

      if (
        leftMonths !== null &&
        rightMonths !== null &&
        leftMonths !== rightMonths
      ) {
        return leftMonths - rightMonths;
      }

      const leftId = `${left.packageType}:${left.identifier}`.toLowerCase();
      const rightId = `${right.packageType}:${right.identifier}`.toLowerCase();
      return leftId.localeCompare(rightId);
    });
  }, [offering]);

  const selectedPackage =
    packages.find((pkg) => pkg.identifier === selectedPackageId) ??
    packages[0] ??
    null;

  const selectedCtaLabel = selectedPackage
    ? t("billing.paywall.continueForPrice", {
        price: selectedPackage.product.priceString,
      })
    : t("billing.paywall.choosePlanFallback");
  const isPaidUser = hasPaidAccess(subscriptionTier);
  const benefitItems = useMemo(
    () => [
      t("billing.paywall.benefits.live"),
      t("billing.paywall.benefits.review"),
      t("billing.paywall.benefits.suggest"),
      t("billing.paywall.benefits.sync"),
    ],
    [t],
  );

  const loadPaywall = useCallback(
    async (options?: { silent?: boolean }) => {
      if (authMode !== "authenticated" || !userId) {
        router.replace("/login");
        return;
      }

      const silent = options?.silent ?? false;
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        await revenueCatService.configureForAuthenticatedUser(userId);
        await refreshProfileFromSession();
        const currentOffering = await revenueCatService.getCurrentOffering();
        setOffering(currentOffering);
        setSelectedPackageId((currentSelectedPackageId) => {
          if (
            currentSelectedPackageId &&
            currentOffering?.availablePackages.some(
              (pkg) => pkg.identifier === currentSelectedPackageId,
            )
          ) {
            return currentSelectedPackageId;
          }

          return currentOffering?.availablePackages?.[0]?.identifier ?? null;
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("billing.paywall.unavailableFallback"),
        );
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [authMode, router, t, userId],
  );

  useEffect(() => {
    if (authMode !== "authenticated" || !userId) {
      router.replace("/login");
    }
  }, [authMode, router, userId]);

  useFocusEffect(
    useCallback(() => {
      if (authMode !== "authenticated" || !userId) {
        return;
      }

      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        void loadPaywall();
        return;
      }

      void loadPaywall({ silent: true });
    }, [authMode, loadPaywall, userId]),
  );

  useEffect(() => {
    if (isPaidUser) {
      setStatusMessage(
        subscriptionSyncState === "syncing"
          ? t("billing.paywall.activeStatusSyncing")
          : t("billing.paywall.activeStatusReady"),
      );
      return;
    }

    setStatusMessage(null);
  }, [isPaidUser, subscriptionSyncState, t]);

  async function handleRestorePress() {
    if (!userId) {
      router.replace("/login");
      return;
    }

    try {
      setIsRestoring(true);
      setStatusMessage(t("billing.paywall.restoreChecking"));
      await revenueCatService.configureForAuthenticatedUser(userId);
      const restoreResult = await revenueCatService.restorePurchases();
      const message = getRestoreSummaryMessage(restoreResult.summary, t);
      setStatusMessage(message);

      if (restoreResult.summary.unlocked) {
        Alert.alert(t("billing.paywall.restoreCompleteTitle"), message, [
          {
            text: t("common.actions.goToProfile"),
            onPress: goToProfile,
          },
          {
            text: t("common.actions.stayHere"),
            style: "cancel",
          },
        ]);
        return;
      }

      Alert.alert(t("billing.paywall.restoreMissingTitle"), message);
    } catch (error) {
      Alert.alert(
        t("billing.paywall.restoreFailedTitle"),
        error instanceof Error
          ? error.message
          : t("billing.paywall.restoreFailedFallback"),
      );
      setStatusMessage(null);
    } finally {
      setIsRestoring(false);
    }
  }

  async function handlePurchaseCompleted(summary: BillingSyncSummary) {
    const message = getPurchaseSummaryMessage(summary, t);
    setStatusMessage(message);

    if (summary.unlocked) {
      Alert.alert(t("billing.paywall.purchaseCompleteTitle"), message, [
        {
          text: t("common.actions.goToProfile"),
          onPress: goToProfile,
        },
      ]);
      return;
    }

    Alert.alert(t("billing.paywall.purchaseReceivedTitle"), message);
  }

  function getPackageTitle(pkg: PurchasesPackage) {
    const raw = getPackageRawLabel(pkg);
    if (raw.includes("annual") || raw.includes("year")) {
      return t("billing.paywall.package.titleYearly");
    }
    if (raw.includes("monthly") || raw.includes("month")) {
      return t("billing.paywall.package.titleMonthly");
    }
    return pkg.product.title || t("billing.paywall.package.titleFallback");
  }

  function getPackageCaption(pkg: PurchasesPackage) {
    const raw = getPackageRawLabel(pkg);
    if (raw.includes("annual") || raw.includes("year")) {
      return t("billing.paywall.package.captionYearly");
    }
    if (raw.includes("monthly") || raw.includes("month")) {
      return t("billing.paywall.package.captionMonthly");
    }
    return t("billing.paywall.package.captionFallback");
  }

  function getPackageBadge(pkg: PurchasesPackage) {
    const raw = getPackageRawLabel(pkg);
    if (raw.includes("annual") || raw.includes("year")) {
      return t("billing.paywall.package.badgeYearly");
    }
    if (raw.includes("monthly") || raw.includes("month")) {
      return t("billing.paywall.package.badgeMonthly");
    }
    return null;
  }

  async function handlePurchasePress() {
    if (!selectedPackage) {
      return;
    }

    try {
      setIsPurchasing(true);
      setStatusMessage(t("billing.paywall.purchaseProcessing"));
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
        setStatusMessage(t("billing.paywall.purchaseCancelled"));
        return;
      }

      setStatusMessage(null);
      Alert.alert(
        t("billing.paywall.purchaseFailedTitle"),
        error instanceof Error
          ? error.message
          : t("billing.paywall.purchaseFailedFallback"),
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
            {t("billing.paywall.webUnsupportedTitle")}
          </Text>
          <Text style={styles.unsupportedBody}>
            {t("billing.paywall.webUnsupportedBody")}
          </Text>
          <Pressable onPress={closeScreen} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {t("common.actions.close")}
            </Text>
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
            accessibilityLabel={t("billing.paywall.closeAccessibilityLabel")}
            onPress={closeScreen}
            style={styles.iconButton}
          >
            <Feather name="x" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              {t("billing.paywall.titleEyebrow")}
            </Text>
            <Text style={styles.title}>
              {isPaidUser
                ? t("billing.paywall.titleAlreadyPro")
                : t("billing.paywall.titleChoosePlan")}
            </Text>
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
              <Text style={styles.loadingText}>
                {t("billing.paywall.loading")}
              </Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>
                {t("billing.paywall.unavailableTitle")}
              </Text>
              <Text style={styles.messageBody}>{errorMessage}</Text>
              <Pressable
                onPress={() => {
                  setIsLoading(true);
                  setErrorMessage(null);
                  setOffering(null);
                  setSelectedPackageId(null);
                  void loadPaywall();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>
                  {t("common.actions.retry")}
                </Text>
              </Pressable>
            </View>
          ) : offering && packages.length > 0 ? (
            <>
              {isPaidUser ? (
                <View style={styles.statusCard}>
                  <Text style={styles.statusCardTitle}>
                    {subscriptionSyncState === "syncing"
                      ? t("billing.paywall.statusCard.syncingTitle")
                      : t("billing.paywall.statusCard.activeTitle")}
                  </Text>
                  <Text style={styles.statusCardBody}>
                    {subscriptionSyncState === "syncing"
                      ? t("billing.paywall.statusCard.syncingBody")
                      : t("billing.paywall.statusCard.activeBody")}
                  </Text>
                </View>
              ) : null}

              <View style={styles.plansSection}>
                <Text style={styles.sectionTitle}>
                  {isPaidUser
                    ? t("billing.paywall.sectionTitleAvailablePlans")
                    : t("billing.paywall.sectionTitlePlans")}
                </Text>
                <View style={styles.packageList}>
                  {packages.map((pkg) => {
                    const selected =
                      selectedPackage?.identifier === pkg.identifier;
                    const badge = getPackageBadge(pkg);
                    const pkgMonthlyEquivalent = getMonthlyEquivalentPrice(pkg);
                    const pkgSavings = getSavingsSummary(packages, pkg);
                    const packageMonths = getPackageMonths(pkg);
                    const isMonthlyPlan = packageMonths === 1;

                    return (
                      <Pressable
                        key={pkg.identifier}
                        accessibilityRole="button"
                        onPress={() => setSelectedPackageId(pkg.identifier)}
                        style={[
                          styles.packageCard,
                          isMonthlyPlan
                            ? styles.packageCardMonthly
                            : styles.packageCardAnnual,
                          selected && styles.packageCardSelected,
                          selected &&
                            (isMonthlyPlan
                              ? styles.packageCardMonthlySelected
                              : styles.packageCardAnnualSelected),
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
                          {selected && pkgSavings ? (
                            <View style={styles.packageBadge}>
                              <Text style={styles.packageBadgeText}>
                                {t("billing.paywall.package.savePercent", {
                                  percent: pkgSavings.percent,
                                })}
                              </Text>
                            </View>
                          ) : selected && badge ? (
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
                            {t(
                              `billing.paywall.package.${getPackagePeriodLabel(pkg)}`,
                            )}
                          </Text>
                          {selected ? (
                            <View style={styles.packagePills}>
                              <View style={styles.packagePill}>
                                <Text style={styles.packagePillText}>
                                  {t(
                                    `billing.paywall.package.${getPackageCycleTextKey(pkg)}`,
                                  )}
                                </Text>
                              </View>
                              {pkgMonthlyEquivalent ? (
                                <View style={styles.packagePill}>
                                  <Text style={styles.packagePillText}>
                                    {t("billing.paywall.package.perMonth", {
                                      price: formatPriceValue(
                                        pkgMonthlyEquivalent,
                                        pkg,
                                        i18n.language,
                                      ),
                                    })}
                                  </Text>
                                </View>
                              ) : null}
                              {pkgSavings ? (
                                <View style={styles.packagePill}>
                                  <Text style={styles.packagePillText}>
                                    {t("billing.paywall.package.saveAmount", {
                                      amount: formatPriceValue(
                                        pkgSavings.absoluteValue,
                                        pkg,
                                        i18n.language,
                                      ),
                                    })}
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
                <Text style={styles.sectionTitle}>
                  {t("billing.paywall.sectionTitleProDetails")}
                </Text>
                {benefitItems.map((item) => (
                  <View key={item} style={styles.benefitRow}>
                    <View style={styles.benefitDot} />
                    <Text style={styles.benefitText}>{item}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.policyCard}>
                <Text style={styles.sectionTitle}>
                  {legalContent.subscription_disclosure.title}
                </Text>
                {legalContent.subscription_disclosure.bullets.map((item) => (
                  <View key={item} style={styles.policyBulletRow}>
                    <View style={styles.policyBulletDot} />
                    <Text style={styles.policyText}>{item}</Text>
                  </View>
                ))}
                <Text style={styles.policyRestoreText}>
                  {legalContent.subscription_disclosure.restore_copy}
                </Text>
                <View style={styles.inlineActions}>
                  <Pressable
                    onPress={() => router.push("/terms" as Href)}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>
                      {t("billing.paywall.inlineActionTerms")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/privacy" as Href)}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>
                      {t("billing.paywall.inlineActionPrivacy")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>
                {t("billing.paywall.noOfferingTitle")}
              </Text>
              <Text style={styles.messageBody}>
                {t("billing.paywall.noOfferingBody")}
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
            disabled={!isPaidUser && (!selectedPackage || isPurchasing)}
            onPress={() => {
              if (isPaidUser) {
                router.push("/customer-center" as Href);
                return;
              }

              void handlePurchasePress();
            }}
            style={[
              styles.primaryButton,
              !isPaidUser &&
                (!selectedPackage || isPurchasing) &&
                styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isPaidUser
                ? subscriptionSyncState === "syncing"
                  ? t("billing.paywall.footerManageBillingSyncing")
                  : t("billing.paywall.footerManageSubscription")
                : isPurchasing
                  ? t("billing.paywall.purchaseProcessing")
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
                {isRestoring
                  ? t("billing.paywall.footerRestoring")
                  : t("billing.paywall.footerRestorePurchases")}
              </Text>
            </Pressable>
            {!isPaidUser ? (
              <Pressable
                onPress={() => router.push("/customer-center" as Href)}
                style={styles.footerTextButton}
              >
                <Text style={styles.footerTextButtonLabel}>
                  {t("billing.paywall.footerManageSubscription")}
                </Text>
              </Pressable>
            ) : null}
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
  statusCard: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(210,244,92,0.28)",
    backgroundColor: "rgba(210,244,92,0.1)",
  },
  statusCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F3FFD2",
  },
  statusCardBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.82)",
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
    borderWidth: 1,
    gap: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  packageCardMonthly: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  packageCardAnnual: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  packageCardSelected: {
    transform: [{ scale: 1.01 }],
    borderColor: "#D2F45C",
    backgroundColor: "rgba(210,244,92,0.14)",
    shadowColor: "#D2F45C",
    shadowOpacity: 0.22,
  },
  packageCardMonthlySelected: {
    borderColor: "#D2F45C",
    backgroundColor: "rgba(210,244,92,0.14)",
    shadowColor: "#D2F45C",
    shadowOpacity: 0.22,
  },
  packageCardAnnualSelected: {
    borderColor: "#D2F45C",
    backgroundColor: "rgba(210,244,92,0.14)",
    shadowColor: "#D2F45C",
    shadowOpacity: 0.22,
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
  policyBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  policyBulletDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: "rgba(210,244,92,0.88)",
  },
  policyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.68)",
  },
  policyRestoreText: {
    fontSize: 13,
    lineHeight: 21,
    color: "#F4FFD0",
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

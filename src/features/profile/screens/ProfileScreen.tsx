import { revenueCatService } from "@/features/billing/services/RevenueCatService";
import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";
import { refreshProfileFromSession, signOut } from "@/shared/api/supabase";
import {
    type AuthProviderName,
    type SubscriptionStatus,
    type SubscriptionTier,
    useAuthStore,
} from "@/shared/store/authStore";
import { useLocaleStore } from "@/shared/store/localeStore";
import {
    palette,
    radii,
    shadows,
    spacing,
    typography,
} from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Animated,
    Easing,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function hasPaidAccess(tier: "free" | "pro" | "unlimited") {
  return tier === "pro" || tier === "unlimited";
}

type RowProps = { label: string; value: string; accent?: boolean };
function DetailRow({ label, value, accent }: RowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, accent && styles.detailValueAccent]}>
        {value}
      </Text>
    </View>
  );
}

function getSubscriptionTierLabel(
  tier: SubscriptionTier | "freePreview",
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (tier === "freePreview") {
    return t("common.subscriptionTier.freePreview");
  }

  return t(`common.subscriptionTier.${tier}`);
}

function getSubscriptionStatusLabel(
  status: SubscriptionStatus,
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (status) {
    case "billing_issue":
      return t("common.subscriptionStatus.billingIssue");
    default:
      return t(`common.subscriptionStatus.${status}`);
  }
}

function getAuthProviderLabel(
  provider: AuthProviderName,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!provider) {
    return t("common.authProvider.unknown");
  }

  return t(`common.authProvider.${provider}`);
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);
  const { i18n, t } = useTranslation();

  const authMode = useAuthStore((s) => s.authMode);
  const displayName = useAuthStore((s) => s.displayName);
  const provider = useAuthStore((s) => s.provider);
  const subscriptionExpiresAt = useAuthStore((s) => s.subscriptionExpiresAt);
  const subscriptionProvider = useAuthStore((s) => s.subscriptionProvider);
  const subscriptionSyncState = useAuthStore((s) => s.subscriptionSyncState);
  const subscriptionStatus = useAuthStore((s) => s.subscriptionStatus);
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);
  const userId = useAuthStore((s) => s.userId);
  const userEmail = useAuthStore((s) => s.userEmail);
  const uiLocale = useLocaleStore((s) => s.uiLocale);
  const learningLanguage = useLocaleStore((s) => s.learningLanguage);
  const followSystemUiLocale = useLocaleStore((s) => s.followSystemUiLocale);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const isAuthenticated = authMode === "authenticated";
  const isPaidUser = hasPaidAccess(subscriptionTier);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !userId) return;
      void revenueCatService
        .configureForAuthenticatedUser(userId)
        .then(() => refreshProfileFromSession())
        .catch((e) => console.error("[Profile] refresh failed:", e));
    }, [isAuthenticated, userId]),
  );

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [authMode, fadeAnim, slideAnim]);

  async function performSignOut() {
    if (isSigningOut) return;
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      setSignOutError(
        e instanceof Error ? e.message : t("profile.signOutFailed"),
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleSignOut() {
    if (!isAuthenticated || isSigningOut) return;
    Alert.alert(
      t("profile.signOutConfirmTitle"),
      t("profile.signOutConfirmMessage"),
      [
        { text: t("common.actions.cancel"), style: "cancel" },
        {
          text: t("common.actions.logOut"),
          style: "destructive",
          onPress: () => void performSignOut(),
        },
      ],
    );
  }

  function handleHeaderAction() {
    if (isSigningOut) return;
    if (isAuthenticated) handleSignOut();
    else router.push("/login");
  }

  function handleUpgrade() {
    router.push(isAuthenticated ? ("/paywall" as Href) : "/login");
  }

  function handleOpenSettings() {
    router.push("/settings" as Href);
  }

  const displayTitle = isAuthenticated
    ? displayName || userEmail || t("profile.talkPilotMember")
    : t("profile.guestAccount");

  const membershipStatusLabel = isAuthenticated
    ? getSubscriptionStatusLabel(subscriptionStatus, t)
    : t("common.status.loginRequired");

  const membershipExpiresLabel = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt).toLocaleDateString(i18n.language)
    : "—";

  const membershipSyncLabel = isAuthenticated
    ? subscriptionSyncState === "syncing"
      ? t("common.status.syncing")
      : t("common.status.synced")
    : t("common.status.loginRequired");
  const appLanguageLabel = followSystemUiLocale
    ? `${t("common.actions.useSystem")} / ${t(`common.languageName.${uiLocale}`)}`
    : t(`common.languageName.${uiLocale}`);
  const learningLanguageLabel = t(`common.languageName.${learningLanguage}`);

  const initials = (displayName || userEmail || "G")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerEyebrow}>{t("profile.headerEyebrow")}</Text>
          <Text style={styles.headerTitle}>{t("profile.headerTitle")}</Text>
        </View>
        <Pressable
          onPress={handleHeaderAction}
          style={[
            styles.headerActionBtn,
            isAuthenticated && styles.headerActionBtnDestructive,
          ]}
          accessibilityLabel={
            isAuthenticated
              ? t("common.actions.logOut")
              : t("common.actions.logIn")
          }
        >
          <Feather
            name={isAuthenticated ? "log-out" : "log-in"}
            size={16}
            color={isAuthenticated ? palette.danger : palette.textAccent}
          />
          <Text
            style={[
              styles.headerActionText,
              isAuthenticated && styles.headerActionTextDestructive,
            ]}
          >
            {isSigningOut
              ? t("common.status.signingOut")
              : isAuthenticated
                ? t("common.actions.logOut")
                : t("common.actions.logIn")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            gap: 14,
          }}
        >
          {/* ── Identity card ── */}
          <View style={styles.identityCard}>
            <LinearGradient
              colors={
                isPaidUser
                  ? [palette.accentDeep, palette.textPrimary]
                  : [palette.textPrimary, palette.accentDeep]
              }
              style={styles.identityGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.identityTop}>
                <View style={[styles.avatar, isPaidUser && styles.avatarPro]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.identityInfo}>
                  <Text style={styles.identityName} numberOfLines={1}>
                    {displayTitle}
                  </Text>
                  <Text style={styles.identityEmail} numberOfLines={1}>
                    {isAuthenticated
                      ? userEmail || t("common.labels.emailUnavailable")
                      : t("common.labels.notSignedIn")}
                  </Text>
                </View>
                {isPaidUser && (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                )}
              </View>

              <View style={styles.identityMeta}>
                <View style={styles.identityMetaItem}>
                  <Feather
                    name="shield"
                    size={12}
                    color={palette.textTertiary}
                  />
                  <Text style={styles.identityMetaText}>
                    {isAuthenticated
                      ? getAuthProviderLabel(provider, t)
                      : t("common.labels.guest")}
                  </Text>
                </View>
                <View style={styles.identityMetaDot} />
                <View style={styles.identityMetaItem}>
                  <Feather
                    name="star"
                    size={12}
                    color={
                      isPaidUser ? palette.textAccent : palette.textTertiary
                    }
                  />
                  <Text
                    style={[
                      styles.identityMetaText,
                      isPaidUser && { color: palette.textAccent },
                    ]}
                  >
                    {getSubscriptionTierLabel(subscriptionTier, t)}
                  </Text>
                </View>
                <View style={styles.identityMetaDot} />
                <View style={styles.identityMetaItem}>
                  <Feather
                    name="activity"
                    size={12}
                    color={palette.textTertiary}
                  />
                  <Text style={styles.identityMetaText}>
                    {membershipStatusLabel}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ── Plan card ── */}
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View
                style={[
                  styles.planTierPill,
                  isPaidUser && styles.planTierPillPro,
                ]}
              >
                <Text
                  style={[
                    styles.planTierText,
                    isPaidUser && styles.planTierTextPro,
                  ]}
                >
                  {getSubscriptionTierLabel(
                    isAuthenticated ? subscriptionTier : "freePreview",
                    t,
                  )}
                </Text>
              </View>
              <Pressable onPress={handleUpgrade} style={styles.upgradeBtn}>
                <Feather
                  name="arrow-up-circle"
                  size={14}
                  color={palette.textOnAccent}
                />
                <Text style={styles.upgradeBtnText}>
                  {isPaidUser
                    ? t("common.actions.viewPlans")
                    : t("common.actions.upgradeToPro")}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.planBody}>
              {isAuthenticated
                ? subscriptionSyncState === "syncing"
                  ? t("profile.membershipBody.syncing")
                  : isPaidUser
                    ? t("profile.membershipBody.active")
                    : t("profile.membershipBody.free")
                : t("profile.membershipBody.guest")}
            </Text>

            {/* Limits grid */}
            <View style={styles.limitsGrid}>
              {[
                {
                  icon: "mic" as const,
                  label: t("profile.limits.live"),
                  free: t("profile.limits.liveFree"),
                  pro: t("profile.limits.livePro"),
                },
                {
                  icon: "check-circle" as const,
                  label: t("profile.limits.review"),
                  free: t("profile.limits.reviewFree"),
                  pro: t("profile.limits.reviewPro"),
                },
                {
                  icon: "zap" as const,
                  label: t("profile.limits.suggest"),
                  free: t("profile.limits.suggestFree"),
                  pro: t("profile.limits.suggestPro"),
                },
              ].map((item) => (
                <View
                  key={item.label}
                  style={[styles.limitItem, isPaidUser && styles.limitItemPro]}
                >
                  <Feather
                    name={item.icon}
                    size={16}
                    color={isPaidUser ? "#D2F45C" : "rgba(255,255,255,0.5)"}
                  />
                  <Text style={styles.limitLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.limitValue,
                      isPaidUser && styles.limitValuePro,
                    ]}
                  >
                    {isPaidUser ? item.pro : item.free}
                  </Text>
                </View>
              ))}
            </View>

            {/* Detail rows */}
            <View style={styles.detailBlock}>
              <DetailRow
                label={t("profile.detail.status")}
                value={membershipStatusLabel}
              />
              <DetailRow
                label={t("profile.detail.sync")}
                value={membershipSyncLabel}
              />
              <DetailRow
                label={t("profile.detail.billing")}
                value={subscriptionProvider || t("common.labels.app")}
              />
              <DetailRow
                label={t("profile.detail.expires")}
                value={membershipExpiresLabel}
              />
              <DetailRow
                label={t("profile.detail.email")}
                value={
                  userEmail ||
                  (isAuthenticated ? t("common.labels.unavailable") : "—")
                }
              />
            </View>

            {signOutError ? (
              <Text style={styles.errorText}>{signOutError}</Text>
            ) : null}

            <Pressable
              onPress={handleOpenSettings}
              style={styles.preferenceCard}
            >
              <View style={styles.preferenceHeader}>
                <View style={styles.preferenceTitleWrap}>
                  <Feather
                    name="settings"
                    size={16}
                    color={palette.textAccent}
                  />
                  <Text style={styles.preferenceTitle}>
                    {t("profile.preferences.title")}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={palette.textTertiary}
                />
              </View>
              <Text style={styles.preferenceBody}>
                {t("profile.preferences.body")}
              </Text>
              <View style={styles.preferenceMetaBlock}>
                <DetailRow
                  label={t("profile.preferences.appLanguage")}
                  value={appLanguageLabel}
                />
                <DetailRow
                  label={t("profile.preferences.learningLanguage")}
                  value={learningLanguageLabel}
                />
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.accentBorder,
    backgroundColor: palette.bgBase,
  },
  headerEyebrow: {
    ...typography.eyebrow,
    letterSpacing: 2.5,
    color: palette.textAccent,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.displayLg,
    fontSize: 30,
    color: palette.textPrimary,
    lineHeight: 34,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm - 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  headerActionBtnDestructive: {
    backgroundColor: palette.dangerLight,
    borderColor: palette.dangerBorder,
  },
  headerActionText: {
    ...typography.labelLg,
    color: palette.textAccent,
  },
  headerActionTextDestructive: {
    color: palette.danger,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  // Identity card
  identityCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...shadows.card,
  },
  identityGradient: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  identityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: palette.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.accentBorder,
  },
  avatarPro: {
    borderColor: palette.accent,
    backgroundColor: palette.accentMuted,
  },
  avatarText: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  identityInfo: { flex: 1 },
  identityName: {
    ...typography.bodyLg,
    fontWeight: "700",
    color: palette.bgCardSolid,
    marginBottom: 3,
  },
  identityEmail: {
    ...typography.bodySm,
    color: "rgba(255,255,255,0.7)",
  },
  proBadge: {
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 5,
    borderRadius: radii.xs,
    backgroundColor: palette.accent,
  },
  proBadgeText: {
    ...typography.labelSm,
    fontWeight: "900",
    color: palette.textOnAccent,
    letterSpacing: 1,
  },
  identityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  identityMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 1,
  },
  identityMetaText: {
    ...typography.labelMd,
    color: "rgba(255,255,255,0.72)",
    textTransform: "capitalize",
  },
  identityMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  // Plan card
  planCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: spacing.md + 2,
    ...shadows.card,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planTitle: {
    ...typography.bodyLg,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  planTierPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  planTierPillPro: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accentBorderStrong,
  },
  planTierText: {
    ...typography.labelMd,
    color: palette.textSecondary,
    textTransform: "capitalize",
  },
  planTierTextPro: {
    color: palette.textAccent,
  },
  planBody: {
    ...typography.bodySm,
    lineHeight: 21,
    color: palette.textSecondary,
  },
  limitsGrid: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  limitItem: {
    flex: 1,
    borderRadius: radii.sm + 2,
    padding: spacing.md,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    alignItems: "center",
    gap: spacing.sm - 2,
  },
  limitItemPro: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accentBorderStrong,
  },
  limitLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  limitValue: {
    ...typography.labelSm,
    color: palette.textPrimary,
    textAlign: "center",
  },
  limitValuePro: {
    color: palette.textAccent,
  },
  detailBlock: {
    borderRadius: radii.md,
    padding: spacing.md + 2,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: spacing.sm + 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailLabel: {
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  detailValue: {
    ...typography.bodySm,
    fontWeight: "700",
    color: palette.textPrimary,
    textTransform: "capitalize",
    textAlign: "right",
    flex: 1,
  },
  detailValueAccent: {
    color: palette.textAccent,
  },
  errorText: {
    ...typography.bodySm,
    color: palette.danger,
    lineHeight: 20,
  },
  preferenceCard: {
    borderRadius: radii.md,
    padding: spacing.md + 2,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: spacing.sm,
  },
  preferenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preferenceTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  preferenceTitle: {
    ...typography.bodySm,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  preferenceBody: {
    ...typography.bodySm,
    color: palette.textSecondary,
    lineHeight: 20,
  },
  preferenceMetaBlock: {
    gap: spacing.sm,
  },
  ctaRow: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
  },
  ctaSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm - 1,
    paddingVertical: 14,
    borderRadius: radii.sm + 2,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  ctaSecondaryText: {
    ...typography.bodySm,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm - 1,
    paddingVertical: 14,
    borderRadius: radii.sm + 2,
    backgroundColor: palette.accent,
  },
  ctaPrimaryText: {
    ...typography.bodySm,
    fontWeight: "800",
    color: palette.textOnAccent,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: palette.accent,
  },
  upgradeBtnText: {
    ...typography.labelMd,
    fontWeight: "800",
    color: palette.textOnAccent,
  },
});

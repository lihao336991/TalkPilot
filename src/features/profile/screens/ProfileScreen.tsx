import { revenueCatService } from "@/features/billing/services/RevenueCatService";
import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";
import { refreshProfileFromSession, signOut } from "@/shared/api/supabase";
import { useAuthStore } from "@/shared/store/authStore";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);

  const authMode = useAuthStore((s) => s.authMode);
  const canManageSubscription = useAuthStore((s) => s.canManageSubscription);
  const displayName = useAuthStore((s) => s.displayName);
  const provider = useAuthStore((s) => s.provider);
  const subscriptionExpiresAt = useAuthStore((s) => s.subscriptionExpiresAt);
  const subscriptionProvider = useAuthStore((s) => s.subscriptionProvider);
  const subscriptionSyncState = useAuthStore((s) => s.subscriptionSyncState);
  const subscriptionStatus = useAuthStore((s) => s.subscriptionStatus);
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);
  const userId = useAuthStore((s) => s.userId);
  const userEmail = useAuthStore((s) => s.userEmail);

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
      setSignOutError(e instanceof Error ? e.message : "Sign out failed.");
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleSignOut() {
    if (!isAuthenticated || isSigningOut) return;
    Alert.alert(
      "Log out?",
      "You'll return to guest mode. Sign in again anytime.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: () => void performSignOut() },
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

  function handleManageBilling() {
    if (!canManageSubscription) { router.push("/login"); return; }
    router.push("/customer-center" as Href);
  }

  const displayTitle = isAuthenticated
    ? displayName || userEmail || "TalkPilot Member"
    : "Guest account";

  const membershipStatusLabel = isAuthenticated
    ? subscriptionStatus === "syncing" ? "syncing" : subscriptionStatus.replace("_", " ")
    : "login required";

  const membershipExpiresLabel = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt).toLocaleDateString()
    : "—";

  const membershipSyncLabel = isAuthenticated
    ? subscriptionSyncState === "syncing" ? "Syncing…" : "Synced"
    : "login required";

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
          <Text style={styles.headerEyebrow}>ACCOUNT</Text>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <Pressable
          onPress={handleHeaderAction}
          style={[styles.headerActionBtn, isAuthenticated && styles.headerActionBtnDestructive]}
          accessibilityLabel={isAuthenticated ? "Sign out" : "Sign in"}
        >
          <Feather
            name={isAuthenticated ? "log-out" : "log-in"}
            size={16}
            color={isAuthenticated ? "#FF6B6B" : "#D2F45C"}
          />
          <Text style={[styles.headerActionText, isAuthenticated && styles.headerActionTextDestructive]}>
            {isSigningOut ? "Signing out…" : isAuthenticated ? "Log out" : "Log in"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], gap: 14 }}>

          {/* ── Identity card ── */}
          <View style={styles.identityCard}>
            <LinearGradient
              colors={isPaidUser ? ["#1A2600", "#0A0A0A"] : ["#141414", "#0A0A0A"]}
              style={styles.identityGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.identityTop}>
                <View style={[styles.avatar, isPaidUser && styles.avatarPro]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.identityInfo}>
                  <Text style={styles.identityName} numberOfLines={1}>{displayTitle}</Text>
                  <Text style={styles.identityEmail} numberOfLines={1}>
                    {isAuthenticated ? userEmail || "Email unavailable" : "Not signed in"}
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
                  <Feather name="shield" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.identityMetaText}>
                    {isAuthenticated ? provider || "account" : "guest"}
                  </Text>
                </View>
                <View style={styles.identityMetaDot} />
                <View style={styles.identityMetaItem}>
                  <Feather name="star" size={12} color={isPaidUser ? "#D2F45C" : "rgba(255,255,255,0.4)"} />
                  <Text style={[styles.identityMetaText, isPaidUser && { color: "#D2F45C" }]}>
                    {subscriptionTier}
                  </Text>
                </View>
                <View style={styles.identityMetaDot} />
                <View style={styles.identityMetaItem}>
                  <Feather name="activity" size={12} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.identityMetaText}>{membershipStatusLabel}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ── Plan card ── */}
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planTitle}>Membership</Text>
              <View style={[styles.planTierPill, isPaidUser && styles.planTierPillPro]}>
                <Text style={[styles.planTierText, isPaidUser && styles.planTierTextPro]}>
                  {isAuthenticated ? subscriptionTier : "free preview"}
                </Text>
              </View>
            </View>

            <Text style={styles.planBody}>
              {isAuthenticated
                ? subscriptionSyncState === "syncing"
                  ? "Purchase confirmed — Pro access is already active while we finish syncing."
                  : isPaidUser
                    ? "Pro is active. Manage billing or restore purchases anytime below."
                    : "Free includes 10 live min, 100 reviews, and 100 suggestions per day."
                : "Sign in before purchasing so your subscription stays synced across devices."}
            </Text>

            {/* Limits grid */}
            <View style={styles.limitsGrid}>
              {[
                { icon: "mic" as const, label: "Live", free: "10 min/day", pro: "120 min/day" },
                { icon: "check-circle" as const, label: "Review", free: "100/day", pro: "Unlimited" },
                { icon: "zap" as const, label: "Suggest", free: "100/day", pro: "Unlimited" },
              ].map((item) => (
                <View key={item.label} style={[styles.limitItem, isPaidUser && styles.limitItemPro]}>
                  <Feather name={item.icon} size={16} color={isPaidUser ? "#D2F45C" : "rgba(255,255,255,0.5)"} />
                  <Text style={styles.limitLabel}>{item.label}</Text>
                  <Text style={[styles.limitValue, isPaidUser && styles.limitValuePro]}>
                    {isPaidUser ? item.pro : item.free}
                  </Text>
                </View>
              ))}
            </View>

            {/* Detail rows */}
            <View style={styles.detailBlock}>
              <DetailRow label="Status" value={membershipStatusLabel} />
              <DetailRow label="Sync" value={membershipSyncLabel} />
              <DetailRow label="Billing" value={subscriptionProvider || "app"} />
              <DetailRow label="Expires" value={membershipExpiresLabel} />
              <DetailRow label="Email" value={userEmail || (isAuthenticated ? "Unavailable" : "—")} />
            </View>

            {signOutError ? (
              <Text style={styles.errorText}>{signOutError}</Text>
            ) : null}

            {/* CTA buttons */}
            <View style={styles.ctaRow}>
              <Pressable onPress={handleUpgrade} style={styles.ctaPrimary}>
                <Feather name="arrow-up-circle" size={15} color="#050505" />
                <Text style={styles.ctaPrimaryText}>
                  {isPaidUser ? "View plans" : "Upgrade to Pro"}
                </Text>
              </Pressable>
              <Pressable onPress={handleManageBilling} style={styles.ctaSecondary}>
                <Text style={styles.ctaSecondaryText}>
                  {isAuthenticated ? "Manage billing" : "Log in first"}
                </Text>
              </Pressable>
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: "#D2F45C",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 34,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(210,244,92,0.1)",
    borderWidth: 1,
    borderColor: "rgba(210,244,92,0.2)",
  },
  headerActionBtnDestructive: {
    backgroundColor: "rgba(255,107,107,0.1)",
    borderColor: "rgba(255,107,107,0.2)",
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D2F45C",
  },
  headerActionTextDestructive: {
    color: "#FF6B6B",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Identity card
  identityCard: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  identityGradient: {
    padding: 20,
    gap: 16,
  },
  identityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  avatarPro: {
    borderColor: "#D2F45C",
    backgroundColor: "rgba(210,244,92,0.12)",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  identityInfo: { flex: 1 },
  identityName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  identityEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  proBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#D2F45C",
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0A0A0A",
    letterSpacing: 1,
  },
  identityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  identityMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  identityMetaText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textTransform: "capitalize",
  },
  identityMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  // Plan card
  planCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    gap: 14,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  planTierPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  planTierPillPro: {
    backgroundColor: "rgba(210,244,92,0.12)",
    borderColor: "rgba(210,244,92,0.3)",
  },
  planTierText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "capitalize",
  },
  planTierTextPro: {
    color: "#D2F45C",
  },
  planBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.5)",
  },
  limitsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  limitItem: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    gap: 6,
  },
  limitItemPro: {
    backgroundColor: "rgba(210,244,92,0.06)",
    borderColor: "rgba(210,244,92,0.15)",
  },
  limitLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  limitValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  limitValuePro: {
    color: "#D2F45C",
  },
  detailBlock: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    textTransform: "capitalize",
    textAlign: "right",
    flex: 1,
  },
  detailValueAccent: {
    color: "#D2F45C",
  },
  errorText: {
    fontSize: 13,
    color: "#FF6B6B",
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
  },
  ctaPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#D2F45C",
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#050505",
  },
  ctaSecondary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  ctaSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
});

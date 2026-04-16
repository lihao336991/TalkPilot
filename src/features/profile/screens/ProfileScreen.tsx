import { revenueCatService } from "@/features/billing/services/RevenueCatService";
import { TabScrollScreen } from "@/features/navigation/components/TabScrollScreen";
import { refreshProfileFromSession, signOut } from "@/shared/api/supabase";
import { useAuthStore } from "@/shared/store/authStore";
import { Feather } from "@expo/vector-icons";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

function hasPaidAccess(subscriptionTier: "free" | "pro" | "unlimited") {
  return subscriptionTier === "pro" || subscriptionTier === "unlimited";
}

export default function ProfileScreen() {
  const router = useRouter();
  const authMode = useAuthStore((state) => state.authMode);
  const canManageSubscription = useAuthStore(
    (state) => state.canManageSubscription,
  );
  const displayName = useAuthStore((state) => state.displayName);
  const provider = useAuthStore((state) => state.provider);
  const subscriptionExpiresAt = useAuthStore(
    (state) => state.subscriptionExpiresAt,
  );
  const subscriptionProvider = useAuthStore(
    (state) => state.subscriptionProvider,
  );
  const subscriptionSyncState = useAuthStore(
    (state) => state.subscriptionSyncState,
  );
  const subscriptionStatus = useAuthStore((state) => state.subscriptionStatus);
  const subscriptionTier = useAuthStore((state) => state.subscriptionTier);
  const userId = useAuthStore((state) => state.userId);
  const userEmail = useAuthStore((state) => state.userEmail);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  const isAuthenticated = authMode === "authenticated";
  const isPaidUser = hasPaidAccess(subscriptionTier);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !userId) {
        return;
      }

      void revenueCatService
        .configureForAuthenticatedUser(userId)
        .then(() => refreshProfileFromSession())
        .catch((error) => {
          console.error("[Profile] Failed to refresh membership state:", error);
        });
    }, [isAuthenticated, userId]),
  );

  useEffect(() => {
    contentOpacity.setValue(0.92);
    contentTranslateY.setValue(8);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [authMode, contentOpacity, contentTranslateY]);

  async function performSignOut() {
    if (isSigningOut) {
      return;
    }

    setSignOutError(null);
    setIsSigningOut(true);

    try {
      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 0.58,
            duration: 140,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(contentTranslateY, {
            toValue: 10,
            duration: 140,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });

      await signOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Sign out failed.",
      );
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleSignOut() {
    if (!isAuthenticated || isSigningOut) {
      return;
    }

    Alert.alert(
      "Log out?",
      "You will return to guest mode on this device. You can sign in again anytime.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => {
            void performSignOut();
          },
        },
      ],
    );
  }

  const displayTitle = isAuthenticated
    ? displayName || userEmail || "TalkPilot Member"
    : "Guest account";
  const displaySubtitle = isAuthenticated
    ? `${userEmail || "Email unavailable"}`
    : "Sign in to keep your account synced across sessions on this device.";
  const providerLabel = isAuthenticated ? provider || "account" : "guest";
  const membershipStatusLabel = isAuthenticated
    ? subscriptionStatus === "syncing"
      ? "syncing"
      : subscriptionStatus.replace("_", " ")
    : "login required";
  const membershipProviderLabel = subscriptionProvider || "app";
  const membershipExpiresLabel = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt).toLocaleDateString()
    : "Not set";
  const membershipSyncLabel = isAuthenticated
    ? subscriptionSyncState === "syncing"
      ? "Purchase confirmed, syncing account"
      : "Account fully synced"
    : "login required";

  const headerActionLabel = isAuthenticated
    ? isSigningOut
      ? "Signing out..."
      : "Log out"
    : "Log in";

  function handleHeaderAction() {
    if (isSigningOut) return;
    if (isAuthenticated) {
      handleSignOut();
    } else {
      router.push("/login");
    }
  }

  function handleUpgradePress() {
    if (isAuthenticated) {
      router.push("/paywall" as Href);
      return;
    }

    router.push("/login");
  }

  function handleManageSubscriptionPress() {
    if (!canManageSubscription) {
      router.push("/login");
      return;
    }

    router.push("/customer-center" as Href);
  }

  return (
    <TabScrollScreen
      title="Account"
      subtitle="Authentication"
      actionLabel={headerActionLabel}
      onActionPress={handleHeaderAction}
      actionAccessibilityLabel={
        isAuthenticated ? "Sign out of your account" : "Open login sheet"
      }
      contentContainerStyle={styles.contentContainer}
    >
      <Animated.View
        style={[
          styles.motionContainer,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        <View style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <View style={styles.avatar}>
              <Feather name="user" size={24} color="#1A1A1A" />
            </View>
            <View style={styles.identityBlock}>
              <Text style={styles.name}>{displayTitle}</Text>
              <Text style={styles.email}>{displaySubtitle}</Text>
            </View>
          </View>

          <View style={styles.metaList}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.metaValue}>
                {isAuthenticated ? "Signed in" : "Guest"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Provider</Text>
              <Text style={styles.metaValue}>
                {isAuthenticated ? provider || "account" : "Guest session"}
              </Text>
            </View>
            {isAuthenticated ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Plan</Text>
                <Text style={styles.metaValue}>{subscriptionTier}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Membership</Text>
              <Text style={styles.metaValue}>{membershipStatusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Membership</Text>
          <Text style={styles.actionBody}>
            {isAuthenticated
              ? subscriptionSyncState === "syncing"
                ? "Your purchase is already confirmed. We're still syncing the account details, but Pro access is already available."
                : isPaidUser
                  ? "This account already has Pro. You can manage billing anytime, and restores should stay linked to this signed-in account."
                  : "Free includes 10 live minutes, 100 reviews, and 100 suggestions per day. Upgrade when you want more room for daily practice."
              : "Log in before purchase so your subscription can stay synced across devices."}
          </Text>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plan</Text>
              <Text style={styles.detailValue}>
                {isAuthenticated ? subscriptionTier : "Free preview"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Live access</Text>
              <Text style={styles.detailValue}>
                {isPaidUser ? "120 min / day" : "10 min / day"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>AI review</Text>
              <Text style={styles.detailValue}>
                {isPaidUser ? "Unlimited" : "100 / day"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>AI suggestion</Text>
              <Text style={styles.detailValue}>
                {isPaidUser ? "Unlimited" : "100 / day"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Membership</Text>
              <Text style={styles.detailValue}>{membershipStatusLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sync state</Text>
              <Text style={styles.detailValue}>{membershipSyncLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Billing source</Text>
              <Text style={styles.detailValue}>{membershipProviderLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expires</Text>
              <Text style={styles.detailValue}>{membershipExpiresLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account</Text>
              <Text style={styles.detailValue}>{providerLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>
                {userEmail ||
                  (isAuthenticated ? "Unavailable" : "Not connected")}
              </Text>
            </View>
          </View>

          {signOutError ? (
            <Text style={styles.errorText}>{signOutError}</Text>
          ) : null}

          <View style={styles.membershipActions}>
            <Pressable
              onPress={handleUpgradePress}
              style={[
                styles.membershipActionButton,
                styles.membershipPrimaryButton,
              ]}
            >
              <Text style={styles.membershipPrimaryButtonText}>
                {isPaidUser ? "View plans" : "Upgrade to Pro"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleManageSubscriptionPress}
              style={[
                styles.membershipActionButton,
                styles.membershipSecondaryButton,
              ]}
            >
              <Text style={styles.membershipSecondaryButtonText}>
                {isAuthenticated ? "Manage billing" : "Log in first"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: 16,
  },
  motionContainer: {
    gap: 16,
  },
  accountCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.08)",
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F2ED",
  },
  identityBlock: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(26,26,26,0.68)",
  },
  metaList: {
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: "rgba(26,26,26,0.52)",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#151619",
    textTransform: "capitalize",
  },
  actionCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#050505",
    gap: 12,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.66)",
  },
  detailList: {
    marginTop: 6,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.48)",
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  errorText: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 20,
    color: "#FF9B88",
  },
  membershipActions: {
    flexDirection: "row",
    gap: 12,
  },
  membershipActionButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  membershipPrimaryButton: {
    backgroundColor: "#FFFFFF",
  },
  membershipSecondaryButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  membershipPrimaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#050505",
  },
  membershipSecondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

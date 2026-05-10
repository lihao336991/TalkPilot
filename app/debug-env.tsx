import { getOrCreateInstallId } from "@/shared/device/installId";
import { useAuthStore } from "@/shared/store/authStore";
import { useSessionStore } from "@/features/live/store/sessionStore";
import { palette, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type DebugRow = {
  label: string;
  value: string;
  tone?: "normal" | "warning" | "ok";
};

function readEnv(name: string) {
  switch (name) {
    case "EXPO_PUBLIC_APP_ENV":
      return process.env.EXPO_PUBLIC_APP_ENV?.trim() || "";
    case "EXPO_PUBLIC_SUPABASE_URL":
      return process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || "";
    case "EXPO_PUBLIC_SUPABASE_ANON_KEY":
      return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
    case "EXPO_PUBLIC_SENTRY_ENVIRONMENT":
      return process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || "";
    case "EXPO_PUBLIC_SENTRY_DSN":
      return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || "";
    case "EXPO_PUBLIC_POSTHOG_HOST":
      return process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || "";
    case "EXPO_PUBLIC_POSTHOG_API_KEY":
      return process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || "";
    case "EXPO_PUBLIC_POSTHOG_DISABLED":
      return process.env.EXPO_PUBLIC_POSTHOG_DISABLED?.trim() || "";
    case "EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS":
      return process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS?.trim() || "";
    case "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID":
      return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";
    case "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID":
      return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";
    default:
      return "";
  }
}

function getSupabaseProjectRef(url: string) {
  try {
    const host = new URL(url).host;
    return host.split(".")[0] || "unknown";
  } catch {
    return "invalid-url";
  }
}

function getHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url ? "invalid-url" : "missing";
  }
}

function fingerprint(value: string) {
  if (!value) {
    return "missing";
  }

  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)} / ${hash.toString(16)}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "null";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function Row({ label, value, tone = "normal" }: DebugRow) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        selectable
        style={[
          styles.rowValue,
          tone === "warning" && styles.rowValueWarning,
          tone === "ok" && styles.rowValueOk,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: DebugRow[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row) => (
        <Row key={row.label} {...row} />
      ))}
    </View>
  );
}

export default function DebugEnvScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [installId, setInstallId] = useState<string>("loading");
  const authMode = useAuthStore((s) => s.authMode);
  const userId = useAuthStore((s) => s.userId);
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);
  const dailyMinutesUsed = useSessionStore((s) => s.dailyMinutesUsed);
  const dailyMinutesLimit = useSessionStore((s) => s.dailyMinutesLimit);

  useEffect(() => {
    let mounted = true;
    getOrCreateInstallId()
      .then((value) => {
        if (mounted) {
          setInstallId(value);
        }
      })
      .catch((error) => {
        if (mounted) {
          setInstallId(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sections = useMemo<{ title: string; rows: DebugRow[] }[]>(() => {
    const appEnv = readEnv("EXPO_PUBLIC_APP_ENV");
    const supabaseUrl = readEnv("EXPO_PUBLIC_SUPABASE_URL");
    const sentryEnv = readEnv("EXPO_PUBLIC_SENTRY_ENVIRONMENT");
    const posthogHost = readEnv("EXPO_PUBLIC_POSTHOG_HOST");
    const expoConfig = Constants.expoConfig;
    const projectRef = getSupabaseProjectRef(supabaseUrl);
    const expectedProduction = appEnv === "production";
    const productionRef = "joweqhgtueqfeasweigh";
    const developmentRef = "ufaphufpewxpeizoewpn";

    return [
      {
        title: "Runtime",
        rows: [
          {
            label: "EXPO_PUBLIC_APP_ENV",
            value: appEnv || "missing",
            tone: expectedProduction ? "ok" : "warning",
          },
          { label: "__DEV__", value: String(__DEV__) },
          { label: "platform", value: Platform.OS },
          { label: "app version", value: expoConfig?.version ?? "unknown" },
          {
            label: "native version",
            value: Constants.nativeAppVersion ?? "unknown",
          },
          {
            label: "native build",
            value: Constants.nativeBuildVersion ?? "unknown",
          },
        ],
      },
      {
        title: "Supabase",
        rows: [
          {
            label: "project ref",
            value: projectRef,
            tone:
              projectRef === productionRef
                ? "ok"
                : projectRef === developmentRef
                  ? "warning"
                  : "normal",
          },
          { label: "host", value: getHost(supabaseUrl) },
          {
            label: "expected prod ref",
            value: productionRef,
          },
          {
            label: "dev ref",
            value: developmentRef,
          },
          {
            label: "anon key",
            value: fingerprint(readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY")),
          },
        ],
      },
      {
        title: "EAS Update",
        rows: [
          { label: "enabled", value: String(Updates.isEnabled) },
          { label: "channel", value: Updates.channel ?? "null" },
          { label: "runtimeVersion", value: Updates.runtimeVersion ?? "null" },
          { label: "updateId", value: Updates.updateId ?? "embedded/null" },
          {
            label: "isEmbeddedLaunch",
            value: String(Updates.isEmbeddedLaunch),
          },
          {
            label: "createdAt",
            value: formatDate(Updates.createdAt),
          },
          {
            label: "isEmergencyLaunch",
            value: String(Updates.isEmergencyLaunch),
            tone: Updates.isEmergencyLaunch ? "warning" : "normal",
          },
          {
            label: "emergency reason",
            value: Updates.emergencyLaunchReason ?? "null",
          },
        ],
      },
      {
        title: "Public Services",
        rows: [
          { label: "sentry env", value: sentryEnv || "missing" },
          {
            label: "sentry dsn",
            value: fingerprint(readEnv("EXPO_PUBLIC_SENTRY_DSN")),
          },
          { label: "posthog host", value: getHost(posthogHost) },
          {
            label: "posthog key",
            value: fingerprint(readEnv("EXPO_PUBLIC_POSTHOG_API_KEY")),
          },
          {
            label: "posthog disabled",
            value: readEnv("EXPO_PUBLIC_POSTHOG_DISABLED") || "missing",
          },
          {
            label: "revenuecat ios key",
            value: fingerprint(readEnv("EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS")),
          },
          {
            label: "google ios client",
            value: fingerprint(readEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID")),
          },
          {
            label: "google web client",
            value: fingerprint(readEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")),
          },
        ],
      },
      {
        title: "Current Session",
        rows: [
          { label: "auth mode", value: authMode ?? "null" },
          { label: "user id", value: userId ?? "null" },
          { label: "install id", value: installId },
          { label: "subscription tier", value: subscriptionTier },
          {
            label: "live usage",
            value: `${dailyMinutesUsed} / ${dailyMinutesLimit} min`,
          },
        ],
      },
    ];
  }, [
    authMode,
    dailyMinutesLimit,
    dailyMinutesUsed,
    installId,
    subscriptionTier,
    userId,
  ]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityLabel="Close debug screen"
        >
          <Feather name="x" size={20} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Hidden diagnostics</Text>
          <Text style={styles.title}>Environment Debug</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        {sections.map((section) => (
          <Section key={section.title} {...section} />
        ))}
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
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.accentBorder,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: palette.bgCardSolid,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    ...typography.caption,
    color: palette.textTertiary,
    textTransform: "uppercase",
  },
  title: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  section: {
    borderWidth: 1,
    borderColor: palette.accentBorder,
    borderRadius: 8,
    backgroundColor: palette.bgCardSolid,
    overflow: "hidden",
  },
  sectionTitle: {
    ...typography.labelLg,
    color: palette.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.bgInput,
  },
  row: {
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.accentBorder,
  },
  rowLabel: {
    ...typography.caption,
    color: palette.textTertiary,
  },
  rowValue: {
    ...typography.bodyMd,
    color: palette.textPrimary,
  },
  rowValueWarning: {
    color: palette.danger,
  },
  rowValueOk: {
    color: palette.textAccent,
  },
});

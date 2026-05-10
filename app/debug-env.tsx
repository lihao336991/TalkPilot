import {
  publicAppEnv,
  publicGoogleIosClientId,
  publicGoogleWebClientId,
  publicPosthogApiKey,
  publicPosthogDisabled,
  publicPosthogHost,
  publicRevenueCatIosKey,
  publicSentryDsn,
  publicSentryEnvironment,
  publicSupabaseAnonKey,
  publicSupabaseUrl,
} from "@/shared/config/publicEnv";
import { getOrCreateInstallId } from "@/shared/device/installId";
import { useSessionStore } from "@/features/live/store/sessionStore";
import { useAuthStore } from "@/shared/store/authStore";
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
  Share,
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

function getSupabaseProjectRef(url: string) {
  try {
    return new URL(url).host.split(".")[0] || "unknown";
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

function Section({ title, rows }: { title: string; rows: DebugRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row) => (
        <Row key={row.label} {...row} />
      ))}
    </View>
  );
}

function formatDiagnostics(sections: { title: string; rows: DebugRow[] }[]) {
  const lines = [
    "TalkPilot Debug Diagnostics",
    `Captured at: ${new Date().toISOString()}`,
  ];

  for (const section of sections) {
    lines.push("", `## ${section.title}`);
    for (const row of section.rows) {
      lines.push(`${row.label}: ${row.value}`);
    }
  }

  return lines.join("\n");
}

export default function DebugEnvScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [installId, setInstallId] = useState("loading");
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
    const expoConfig = Constants.expoConfig;
    const projectRef = getSupabaseProjectRef(publicSupabaseUrl);
    const productionRef = "joweqhgtueqfeasweigh";
    const developmentRef = "ufaphufpewxpeizoewpn";

    return [
      {
        title: "Runtime",
        rows: [
          {
            label: "EXPO_PUBLIC_APP_ENV",
            value: publicAppEnv || "missing",
            tone: publicAppEnv === "production" ? "ok" : "warning",
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
          { label: "host", value: getHost(publicSupabaseUrl) },
          { label: "expected prod ref", value: productionRef },
          { label: "dev ref", value: developmentRef },
          { label: "anon key", value: fingerprint(publicSupabaseAnonKey) },
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
          { label: "createdAt", value: formatDate(Updates.createdAt) },
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
          { label: "sentry env", value: publicSentryEnvironment || "missing" },
          { label: "sentry dsn", value: fingerprint(publicSentryDsn) },
          { label: "posthog host", value: getHost(publicPosthogHost) },
          { label: "posthog key", value: fingerprint(publicPosthogApiKey) },
          {
            label: "posthog disabled",
            value: publicPosthogDisabled || "missing",
          },
          {
            label: "revenuecat ios key",
            value: fingerprint(publicRevenueCatIosKey),
          },
          {
            label: "google ios client",
            value: fingerprint(publicGoogleIosClientId),
          },
          {
            label: "google web client",
            value: fingerprint(publicGoogleWebClientId),
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

  async function copyDiagnostics() {
    await Share.share({
      message: formatDiagnostics(sections),
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Feather name="x" size={22} color={palette.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Debug</Text>
        <Pressable
          accessibilityRole="button"
          onPress={copyDiagnostics}
          style={styles.copyButton}
        >
          <Feather name="copy" size={16} color={palette.textPrimary} />
          <Text style={styles.copyButtonText}>Copy</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
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
  screen: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.neutralBorder,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  copyButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.neutralBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  copyButtonText: {
    ...typography.labelMd,
    color: palette.textPrimary,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.labelLg,
    color: palette.textPrimary,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.neutralBorder,
    gap: spacing.xs,
  },
  rowLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    textTransform: "uppercase",
  },
  rowValue: {
    ...typography.bodySm,
    color: palette.textPrimary,
  },
  rowValueWarning: {
    color: palette.danger,
  },
  rowValueOk: {
    color: palette.accentDark,
  },
});

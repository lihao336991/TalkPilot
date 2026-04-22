import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";
import { supabase } from "@/shared/api/supabase";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";

type HistorySession = {
  id: string;
  scene_preset: string | null;
  scene_description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
};

const HISTORY_CACHE_TTL_MS = 30_000;
let historySessionsCache: HistorySession[] = [];
let historySessionsCacheAt = 0;

function formatDuration(
  s: number | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!s || s <= 0) return t("history.duration.lessThanOneMinute");
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return t("history.duration.seconds", { count: sec });
  if (sec === 0) return t("history.duration.minutesOnly", { count: m });
  return t("history.duration.minutesSeconds", { minutes: m, seconds: sec });
}

function formatSessionDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSceneLabel(
  session: HistorySession,
  t: (key: string) => string,
): string {
  if (session.scene_description?.trim()) return session.scene_description.trim();
  if (session.scene_preset) {
    return session.scene_preset
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }
  return t("history.scene.freeConversation");
}

function statusColor(status: string): string {
  if (status === "ended") return palette.accentDark;
  if (status === "paused") return "#B45309";
  return "#2563EB";
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const tabBarHeight = getTabBarHeight(insets.bottom);
  const [sessions, setSessions] = useState<HistorySession[]>(historySessionsCache);
  const [isLoading, setIsLoading] = useState(historySessionsCache.length === 0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async (opts?: { force?: boolean }) => {
    const useCache =
      !opts?.force &&
      historySessionsCache.length > 0 &&
      Date.now() - historySessionsCacheAt < HISTORY_CACHE_TTL_MS;

    if (useCache) {
      setSessions(historySessionsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("sessions")
      .select("id, scene_preset, scene_description, started_at, ended_at, duration_seconds, status")
      .order("started_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message || t("billing.paywall.unavailableFallback"));
      if (historySessionsCache.length === 0) setSessions([]);
      setIsLoading(false);
      return;
    }

    const next = data ?? [];
    historySessionsCache = next;
    historySessionsCacheAt = Date.now();
    setSessions(next);
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadSessions({ force: true });
    setRefreshing(false);
  }

  const totalMinutes = Math.round(
    sessions.reduce((sum, s) => sum + Math.max(s.duration_seconds ?? 0, 0), 0) / 60,
  );
  const completedCount = sessions.filter((s) => s.status === "ended").length;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerEyebrow}>{t("history.headerEyebrow")}</Text>
          <Text style={styles.headerTitle}>{t("history.headerTitle")}</Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={styles.refreshBtn}
          accessibilityLabel={t("history.refreshAccessibilityLabel")}
        >
          <Feather name="refresh-cw" size={18} color={refreshing ? palette.textAccent : palette.textSecondary} />
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
        {/* ── Stats banner ── */}
        <LinearGradient
          colors={[palette.accentMuted, palette.bgCardSolid]}
          style={styles.statsBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessions.length}</Text>
              <Text style={styles.statLabel}>{t("history.stats.sessions")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalMinutes}</Text>
              <Text style={styles.statLabel}>{t("history.stats.minutesPracticed")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>{t("history.stats.completed")}</Text>
            </View>
          </View>
          <View style={styles.statsAccentLine} />
        </LinearGradient>

        {/* ── Loading ── */}
        {isLoading && (
          <View style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
              <Feather name="loader" size={22} color={palette.textTertiary} />
            </View>
            <Text style={styles.stateTitle}>{t("history.state.loadingTitle")}</Text>
            <Text style={styles.stateBody}>{t("history.state.loadingBody")}</Text>
          </View>
        )}

        {/* ── Error ── */}
        {!isLoading && errorMessage && sessions.length === 0 && (
          <View style={styles.stateCard}>
            <View style={[styles.stateIconWrap, { backgroundColor: palette.dangerLight }]}>
              <Feather name="alert-circle" size={22} color={palette.danger} />
            </View>
            <Text style={styles.stateTitle}>{t("history.state.errorTitle")}</Text>
            <Text style={styles.stateBody}>{errorMessage}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadSessions({ force: true })}>
              <Text style={styles.retryBtnText}>{t("common.actions.tryAgain")}</Text>
            </Pressable>
          </View>
        )}

        {/* ── Empty ── */}
        {!isLoading && !errorMessage && sessions.length === 0 && (
          <View style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
              <Feather name="mic-off" size={22} color={palette.textTertiary} />
            </View>
            <Text style={styles.stateTitle}>{t("history.state.emptyTitle")}</Text>
            <Text style={styles.stateBody}>
              {t("history.state.emptyBody")}
            </Text>
          </View>
        )}

        {/* ── Session cards ── */}
        {!isLoading &&
          !errorMessage &&
          sessions.map((session) => {
            const accent = statusColor(session.status);
            return (
              <View key={session.id} style={styles.card}>
                {/* left accent bar */}
                <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />

                <View style={styles.cardInner}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {formatSceneLabel(session, t)}
                    </Text>
                    <View style={[styles.statusPill, { borderColor: `${accent}40`, backgroundColor: `${accent}14` }]}>
                      <View style={[styles.statusDot, { backgroundColor: accent }]} />
                      <Text style={[styles.statusText, { color: accent }]}>
                        {session.status === "ended"
                          ? t("history.sessionStatus.ended")
                          : session.status === "paused"
                            ? t("history.sessionStatus.paused")
                            : t("history.sessionStatus.active")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardMetaRow}>
                    <Feather name="clock" size={12} color={palette.textTertiary} />
                    <Text style={styles.cardMeta}>
                      {formatDuration(session.duration_seconds, t)}
                    </Text>
                    <Text style={styles.cardMetaDot}>·</Text>
                    <Text style={styles.cardMeta}>
                      {formatSessionDate(session.started_at, i18n.language)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
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
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  statsBanner: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...shadows.card,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: {
    ...typography.displayLg,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: palette.accentBorder,
  },
  statsAccentLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: palette.accent,
    opacity: 0.35,
  },
  stateCard: {
    borderRadius: radii.lg,
    padding: spacing.xxl,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
    ...shadows.card,
  },
  stateIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    ...typography.bodyLg,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  stateBody: {
    ...typography.bodySm,
    lineHeight: 21,
    color: palette.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  retryBtnText: {
    ...typography.labelLg,
    color: palette.textOnAccent,
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.cardSm,
  },
  cardAccentBar: {
    width: 3,
    borderRadius: 2,
    margin: spacing.md + 2,
    marginRight: 0,
    opacity: 0.8,
  },
  cardInner: {
    flex: 1,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm + 2,
  },
  cardTitle: {
    flex: 1,
    ...typography.bodyMd,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 1,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.labelSm,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 1,
  },
  cardMeta: {
    ...typography.labelMd,
    color: palette.textSecondary,
  },
  cardMetaDot: {
    ...typography.labelMd,
    color: palette.textTertiary,
  },
});

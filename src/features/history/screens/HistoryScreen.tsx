import { getTabBarHeight } from "@/features/navigation/components/CustomTabBar";
import { supabase } from "@/shared/api/supabase";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function formatDuration(s: number | null): string {
  if (!s || s <= 0) return "< 1 min";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m} min`;
  return `${m} min ${sec}s`;
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSceneLabel(session: HistorySession): string {
  if (session.scene_description?.trim()) return session.scene_description.trim();
  if (session.scene_preset) {
    return session.scene_preset
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }
  return "Free conversation";
}

function statusColor(status: string): string {
  if (status === "ended") return "#D2F45C";
  if (status === "paused") return "#FF9F6B";
  return "#8EC5FF";
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
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
      setErrorMessage(error.message || "Failed to load sessions.");
      if (historySessionsCache.length === 0) setSessions([]);
      setIsLoading(false);
      return;
    }

    const next = data ?? [];
    historySessionsCache = next;
    historySessionsCacheAt = Date.now();
    setSessions(next);
    setIsLoading(false);
  }, []);

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
          <Text style={styles.headerEyebrow}>HISTORY</Text>
          <Text style={styles.headerTitle}>Sessions</Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh session history"
        >
          <Feather name="refresh-cw" size={18} color={refreshing ? "#D2F45C" : "rgba(255,255,255,0.55)"} />
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
          colors={["#111A00", "#0A0A0A"]}
          style={styles.statsBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessions.length}</Text>
              <Text style={styles.statLabel}>sessions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalMinutes}</Text>
              <Text style={styles.statLabel}>min practiced</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>completed</Text>
            </View>
          </View>
          <View style={styles.statsAccentLine} />
        </LinearGradient>

        {/* ── Loading ── */}
        {isLoading && (
          <View style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
              <Feather name="loader" size={22} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.stateTitle}>Loading sessions…</Text>
            <Text style={styles.stateBody}>Pulling your conversation history.</Text>
          </View>
        )}

        {/* ── Error ── */}
        {!isLoading && errorMessage && sessions.length === 0 && (
          <View style={styles.stateCard}>
            <View style={[styles.stateIconWrap, { backgroundColor: "rgba(255,80,80,0.12)" }]}>
              <Feather name="alert-circle" size={22} color="#FF6B6B" />
            </View>
            <Text style={styles.stateTitle}>Could not load history</Text>
            <Text style={styles.stateBody}>{errorMessage}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadSessions({ force: true })}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {/* ── Empty ── */}
        {!isLoading && !errorMessage && sessions.length === 0 && (
          <View style={styles.stateCard}>
            <View style={styles.stateIconWrap}>
              <Feather name="mic-off" size={22} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.stateTitle}>No sessions yet</Text>
            <Text style={styles.stateBody}>
              Start a conversation in Live and end it to see it appear here.
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
                      {formatSceneLabel(session)}
                    </Text>
                    <View style={[styles.statusPill, { borderColor: `${accent}40`, backgroundColor: `${accent}14` }]}>
                      <View style={[styles.statusDot, { backgroundColor: accent }]} />
                      <Text style={[styles.statusText, { color: accent }]}>
                        {session.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardMetaRow}>
                    <Feather name="clock" size={12} color="rgba(255,255,255,0.35)" />
                    <Text style={styles.cardMeta}>
                      {formatDuration(session.duration_seconds)}
                    </Text>
                    <Text style={styles.cardMetaDot}>·</Text>
                    <Text style={styles.cardMeta}>
                      {formatSessionDate(session.started_at)}
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
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  statsBanner: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(210,244,92,0.12)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  statsAccentLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#D2F45C",
    opacity: 0.35,
  },
  stateCard: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  stateIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  card: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    overflow: "hidden",
  },
  cardAccentBar: {
    width: 3,
    borderRadius: 2,
    margin: 14,
    marginRight: 0,
    opacity: 0.8,
  },
  cardInner: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  cardMetaDot: {
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
  },
});

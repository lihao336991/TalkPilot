import React, { useCallback, useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';
import { supabase } from '@/shared/api/supabase';

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

function formatDuration(durationSeconds: number | null): string {
  if (!durationSeconds || durationSeconds <= 0) {
    return 'Less than 1 min';
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${seconds}s`;
}

function formatSessionDate(isoString: string): string {
  const date = new Date(isoString);

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSceneLabel(session: HistorySession): string {
  if (session.scene_description?.trim()) {
    return session.scene_description.trim();
  }

  if (session.scene_preset) {
    return session.scene_preset
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return 'Free conversation';
}

function buildSessionSummary(session: HistorySession): string {
  if (session.status === 'active') {
    return 'Session is still active. End it from Live to save the final duration.';
  }

  if (session.status === 'paused') {
    return 'Session is paused and can be resumed from the Live tab.';
  }

  if (!session.ended_at) {
    return 'Session has started but no final wrap-up data is available yet.';
  }

  return `Started on ${formatSessionDate(session.started_at)} and saved for later review.`;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<HistorySession[]>(historySessionsCache);
  const [isLoading, setIsLoading] = useState(historySessionsCache.length === 0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSessions = useCallback(async (options?: { force?: boolean }) => {
    const shouldUseCache =
      !options?.force &&
      historySessionsCache.length > 0 &&
      Date.now() - historySessionsCacheAt < HISTORY_CACHE_TTL_MS;

    if (shouldUseCache) {
      setErrorMessage(null);
      setSessions(historySessionsCache);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('sessions')
      .select(
        'id, scene_preset, scene_description, started_at, ended_at, duration_seconds, status',
      )
      .order('started_at', { ascending: false });

    if (error) {
      setErrorMessage(error.message || 'Failed to load sessions.');
      if (historySessionsCache.length === 0) {
        setSessions([]);
      }
      setIsLoading(false);
      return;
    }

    const nextSessions = data ?? [];
    historySessionsCache = nextSessions;
    historySessionsCacheAt = Date.now();
    setSessions(nextSessions);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const totalMinutes = Math.round(
    sessions.reduce(
      (sum, session) => sum + Math.max(session.duration_seconds ?? 0, 0),
      0,
    ) / 60,
  );
  const endedSessionsCount = sessions.filter(
    (session) => session.status === 'ended',
  ).length;

  return (
    <TabScrollScreen
      title="History"
      subtitle="Session recap and review"
      actionIcon="refresh-cw"
      onActionPress={() => {
        void loadSessions({ force: true });
      }}
      actionAccessibilityLabel="Refresh session history"
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>Recent activity</Text>
        <Text style={styles.summaryTitle}>
          Your latest assisted conversations stay organized here for review.
        </Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryValue}>{sessions.length}</Text>
            <Text style={styles.summaryLabel}>saved sessions</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>{totalMinutes}</Text>
            <Text style={styles.summaryLabel}>minutes practiced</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>{endedSessionsCount}</Text>
            <Text style={styles.summaryLabel}>completed</Text>
          </View>
        </View>
      </View>

      {isLoading && (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Loading sessions...</Text>
          <Text style={styles.stateDescription}>
            Pulling your latest conversation history from Supabase.
          </Text>
        </View>
      )}

      {!isLoading && errorMessage && sessions.length === 0 && (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Could not load history</Text>
          <Text style={styles.stateDescription}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => {
            void loadSessions({ force: true });
          }}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !errorMessage && sessions.length === 0 && (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No saved sessions yet</Text>
          <Text style={styles.stateDescription}>
            Start a conversation in Live and end it once to see it appear here.
          </Text>
        </View>
      )}

      {!isLoading && !errorMessage && sessions.map((session) => (
        <View key={session.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>{formatSceneLabel(session)}</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    session.status === 'ended'
                      ? styles.statusEnded
                      : session.status === 'paused'
                        ? styles.statusPaused
                        : styles.statusActive,
                  ]}
                />
                <Text style={styles.statusText}>{session.status}</Text>
              </View>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color="rgba(26,26,26,0.3)"
            />
          </View>
          <Text style={styles.cardMeta}>
            {formatDuration(session.duration_seconds)} · {formatSessionDate(session.started_at)}
          </Text>
          <Text style={styles.cardSummary}>{buildSessionSummary(session)}</Text>
        </View>
      ))}
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 26,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    marginBottom: 24,
  },
  summaryEyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(26,26,26,0.36)',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(26,26,26,0.52)',
    marginTop: 4,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusEnded: {
    backgroundColor: '#34C759',
  },
  statusPaused: {
    backgroundColor: '#FF9500',
  },
  statusActive: {
    backgroundColor: '#4A90E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.52)',
    textTransform: 'capitalize',
  },
  cardMeta: {
    fontSize: 12,
    color: 'rgba(26,26,26,0.42)',
    marginBottom: 10,
  },
  cardSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(26,26,26,0.7)',
  },
  stateCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  stateDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(26,26,26,0.68)',
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#151619',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

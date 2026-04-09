import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';

const sessions = [
  {
    title: 'Investor update rehearsal',
    meta: '18 min · 36 prompts · Confidence 84%',
    summary: 'Focused on concise status updates and clear follow-up asks.',
  },
  {
    title: 'Coffee chat recovery',
    meta: '9 min · 14 prompts · Confidence 78%',
    summary: 'Captured filler-word fixes and smoother small-talk transitions.',
  },
  {
    title: 'Airport support scenario',
    meta: '6 min · 11 prompts · Confidence 88%',
    summary: 'Saved practical travel phrases and next-step clarification cues.',
  },
];

export default function HistoryScreen() {
  return (
    <TabScrollScreen title="History" subtitle="Session recap and review" actionIcon="clock">
      <View style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>Recent activity</Text>
        <Text style={styles.summaryTitle}>Your latest assisted conversations stay organized here for review.</Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryValue}>3</Text>
            <Text style={styles.summaryLabel}>saved sessions</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>61</Text>
            <Text style={styles.summaryLabel}>reply suggestions</Text>
          </View>
        </View>
      </View>

      {sessions.map((session) => (
        <View key={session.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{session.title}</Text>
            <Feather name="chevron-right" size={18} color="rgba(26,26,26,0.3)" />
          </View>
          <Text style={styles.cardMeta}>{session.meta}</Text>
          <Text style={styles.cardSummary}>{session.summary}</Text>
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
    gap: 24,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
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
});

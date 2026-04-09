import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';

const metrics = [
  { label: 'Weekly practice', value: '4.2h' },
  { label: 'Helpful replies', value: '128' },
  { label: 'Saved phrases', value: '37' },
];

export default function ProfileScreen() {
  return (
    <TabScrollScreen title="Profile" subtitle="Preferences and learning signal" actionIcon="settings">
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Feather name="user" size={26} color="#1A1A1A" />
        </View>
        <Text style={styles.name}>TalkPilot Workspace</Text>
        <Text style={styles.email}>Ready for account, subscription, and preference settings.</Text>
      </View>

      <View style={styles.metricsRow}>
        {metrics.map((item) => (
          <View key={item.label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.preferenceCard}>
        <Text style={styles.preferenceTitle}>Suggested next settings</Text>
        <Text style={styles.preferenceItem}>Microphone permission onboarding</Text>
        <Text style={styles.preferenceItem}>Target accent and response tone presets</Text>
        <Text style={styles.preferenceItem}>Conversation history sync and export</Text>
      </View>
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F2ED',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: 'rgba(26,26,26,0.68)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#151619',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricLabel: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.64)',
  },
  preferenceCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
  },
  preferenceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  preferenceItem: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(26,26,26,0.72)',
    marginBottom: 10,
  },
});

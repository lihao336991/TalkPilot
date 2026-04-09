import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const checks = [
  'Expo Router entry is active.',
  'Custom Tab shell is mounted from src/features/navigation.',
  'iOS Swift shell keeps the TalkPilot project name and bundle identifier.',
  'Microphone permission is declared for future real-time conversation features.',
];

export default function TestScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TalkPilot Dev</Text>
      <Text style={styles.subtitle}>Use this page as a lightweight handoff point for future API, audio, and streaming checks.</Text>
      <View style={styles.card}>
        {checks.map((item) => (
          <View key={item} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(26,26,26,0.7)',
    marginBottom: 24,
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#151619',
    marginTop: 7,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#1A1A1A',
  },
});

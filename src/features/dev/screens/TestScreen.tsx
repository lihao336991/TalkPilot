import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sentry } from '@/shared/monitoring/sentry';

const checks = [
  'Expo Router entry is active.',
  'Custom Tab shell is mounted from src/features/navigation.',
  'iOS Swift shell keeps the TalkPilot project name and bundle identifier.',
  'Microphone permission is declared for future real-time conversation features.',
];

export default function TestScreen() {
  const [status, setStatus] = useState<string | null>(null);

  const sendTestMessage = async () => {
    const eventId = Sentry.captureMessage('TalkPilot manual Sentry test message', 'info');
    await Sentry.flush();

    setStatus(`Message sent: ${eventId}`);
    Alert.alert('Sentry test sent', `Message event id:\n${eventId}`);
  };

  const sendTestException = async () => {
    const error = new Error('TalkPilot manual Sentry test exception');
    const eventId = Sentry.captureException(error, {
      tags: {
        source: 'dev-test-screen',
      },
    });

    await Sentry.flush();

    setStatus(`Exception sent: ${eventId}`);
    Alert.alert('Sentry test sent', `Exception event id:\n${eventId}`);
  };

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
      <View style={styles.actions}>
        <Pressable onPress={() => void sendTestMessage()} style={[styles.button, styles.secondaryButton]}>
          <Text style={styles.secondaryButtonText}>Send test message</Text>
        </Pressable>
        <Pressable onPress={() => void sendTestException()} style={[styles.button, styles.primaryButton]}>
          <Text style={styles.primaryButtonText}>Send test exception</Text>
        </Pressable>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
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
  actions: {
    marginTop: 18,
    gap: 12,
  },
  button: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#151619',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.12)',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#151619',
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
  status: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(26,26,26,0.68)',
  },
});

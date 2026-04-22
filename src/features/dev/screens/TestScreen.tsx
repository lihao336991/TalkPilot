import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sentry } from '@/shared/monitoring/sentry';
import { palette, radii, shadows, spacing, typography } from '@/shared/theme/tokens';

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
    backgroundColor: palette.bgBase,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  title: {
    ...typography.displayLg,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: spacing.sm + 2,
  },
  subtitle: {
    ...typography.bodyMd,
    lineHeight: 22,
    color: palette.textSecondary,
    marginBottom: spacing.xxl,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: palette.bgCard,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...shadows.card,
  },
  actions: {
    marginTop: spacing.lg + 2,
    gap: spacing.md,
  },
  button: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: palette.accent,
  },
  secondaryButton: {
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  primaryButtonText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: palette.textOnAccent,
  },
  secondaryButtonText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    marginBottom: spacing.md + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.xs / 2,
    backgroundColor: palette.accentDark,
    marginTop: 7,
  },
  rowText: {
    flex: 1,
    ...typography.bodySm,
    lineHeight: 22,
    color: palette.textPrimary,
  },
  status: {
    marginTop: spacing.md + 2,
    ...typography.bodySm,
    lineHeight: 18,
    color: palette.textSecondary,
  },
});

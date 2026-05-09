import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAlert } from '@/shared/components';
import { AudioEngine, audioEngine } from '@/features/live/services/AudioEngine';
import { voiceEnrollmentService } from '@/features/live/services/VoiceEnrollmentService';
import { voiceprintService, type VoiceprintDecision } from '@/features/live/services/VoiceprintService';
import {
  useConversationStore,
  type VoiceprintDecisionLabel,
} from '@/features/live/store/conversationStore';
import { palette, radii, shadows, spacing, typography } from '@/shared/theme/tokens';

type ExpectedSpeaker = 'self' | 'other';
type Snapshot = VoiceprintDecision & {
  takenAt: number;
};

type TestSummary = {
  dominantLabel: VoiceprintDecisionLabel;
  expectedHitRate: number | null;
  stableSampleCount: number;
  unknownSampleCount: number;
  averageSimilarity: number | null;
  peakSimilarity: number | null;
  floorSimilarity: number | null;
  matchedExpected: boolean | null;
};

type EnrollmentMeta = {
  availability: 'missing' | 'legacy_pcm_only' | 'ready';
  profileCreatedAt: number | null;
  profileDurationMs: number | null;
  profileModel: string | null;
};

type TestModeConfig = {
  title: string;
  description: string;
  instruction: string;
};

const SNAPSHOT_INTERVAL_MS = 200;
const HISTORY_LIMIT = 14;

function formatSimilarity(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(3);
}

function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${Math.round(value * 100)}%`;
}

function formatDurationMs(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${(value / 1000).toFixed(1)}s`;
}

function computeDominantLabel(samples: Snapshot[]): VoiceprintDecisionLabel {
  const counts = {
    self: 0,
    other: 0,
    unknown: 0,
  };

  for (const sample of samples) {
    counts[sample.label] += 1;
  }

  if (counts.self === 0 && counts.other === 0 && counts.unknown === 0) {
    return 'unknown';
  }

  const sorted = (Object.entries(counts) as Array<[VoiceprintDecisionLabel, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  return sorted[0]?.[0] ?? 'unknown';
}

function summarizeSamples(
  samples: Snapshot[],
  expectedSpeaker: ExpectedSpeaker,
): TestSummary | null {
  if (samples.length === 0) {
    return null;
  }

  const stableSamples = samples.filter((sample) => sample.label !== 'unknown');
  const similarities = samples
    .map((sample) => sample.similarity)
    .filter((value): value is number => typeof value === 'number');
  const dominantLabel = computeDominantLabel(samples);
  const expectedHits = stableSamples.filter((sample) => sample.label === expectedSpeaker).length;

  return {
    dominantLabel,
    expectedHitRate:
      stableSamples.length > 0 ? expectedHits / stableSamples.length : null,
    stableSampleCount: stableSamples.length,
    unknownSampleCount: samples.length - stableSamples.length,
    averageSimilarity:
      similarities.length > 0
        ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
        : null,
    peakSimilarity:
      similarities.length > 0 ? Math.max(...similarities) : null,
    floorSimilarity:
      similarities.length > 0 ? Math.min(...similarities) : null,
    matchedExpected:
      dominantLabel === 'unknown' ? null : dominantLabel === expectedSpeaker,
  };
}

function getDecisionTone(label: VoiceprintDecisionLabel | null) {
  if (label === 'self') {
    return {
      backgroundColor: 'rgba(52,199,89,0.14)',
      borderColor: 'rgba(52,199,89,0.24)',
      textColor: '#137333',
    };
  }

  if (label === 'other') {
    return {
      backgroundColor: 'rgba(255,149,0,0.14)',
      borderColor: 'rgba(255,149,0,0.24)',
      textColor: '#B16000',
    };
  }

  return {
    backgroundColor: 'rgba(100,116,139,0.12)',
    borderColor: 'rgba(100,116,139,0.18)',
    textColor: palette.textSecondary,
  };
}

export default function VoiceprintDebugScreen() {
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const voiceprintEnabled = useConversationStore((state) => state.voiceprintEnabled);
  const voiceprintEnrollmentReady = useConversationStore(
    (state) => state.voiceprintEnrollmentReady,
  );
  const lastVoiceprintSimilarity = useConversationStore(
    (state) => state.lastVoiceprintSimilarity,
  );
  const lastVoiceprintDecision = useConversationStore(
    (state) => state.lastVoiceprintDecision,
  );
  const lastVoiceprintConfidence = useConversationStore(
    (state) => state.lastVoiceprintConfidence,
  );
  const lastVoiceprintReason = useConversationStore(
    (state) => state.lastVoiceprintReason,
  );
  const lastVoiceprintThresholdHigh = useConversationStore(
    (state) => state.lastVoiceprintThresholdHigh,
  );
  const lastVoiceprintThresholdLow = useConversationStore(
    (state) => state.lastVoiceprintThresholdLow,
  );
  const lastVoiceprintInputDurationMs = useConversationStore(
    (state) => state.lastVoiceprintInputDurationMs,
  );
  const lastVoiceprintMelFrameCount = useConversationStore(
    (state) => state.lastVoiceprintMelFrameCount,
  );

  const [expectedSpeaker, setExpectedSpeaker] = useState<ExpectedSpeaker>('self');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [enrollmentMeta, setEnrollmentMeta] = useState<EnrollmentMeta | null>(null);
  const [samples, setSamples] = useState<Snapshot[]>([]);
  const [lastRunSummary, setLastRunSummary] = useState<TestSummary | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const samplesRef = useRef<Snapshot[]>([]);

  const clearSnapshotTimer = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearInterval(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
  }, []);

  const appendSnapshot = useCallback((decision: VoiceprintDecision) => {
    const snapshot: Snapshot = {
      ...decision,
      takenAt: Date.now(),
    };

    samplesRef.current = [...samplesRef.current, snapshot];
    setSamples(samplesRef.current.slice(-HISTORY_LIMIT));
  }, []);

  const refreshEnvironment = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await voiceprintService.hydrateEnrollmentState();
      const availability = await voiceEnrollmentService.getEnrollmentAvailability();
      const profile = await voiceEnrollmentService.loadEnrollmentProfile();
      setEnrollmentMeta({
        availability,
        profileCreatedAt: profile?.createdAt ?? null,
        profileDurationMs: profile?.durationMs ?? null,
        profileModel: profile?.model ?? null,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearSnapshotTimer();
    try {
      await audioEngine.stop();
    } catch {}
    voiceprintService.stopSessionAnalysis();
    setIsRecording(false);

    const latestDecision = voiceprintService.getCurrentDecision();
    appendSnapshot(latestDecision);

    setLastRunSummary(summarizeSamples(samplesRef.current, expectedSpeaker));
  }, [appendSnapshot, clearSnapshotTimer, expectedSpeaker]);

  const startRecording = useCallback(async () => {
    await refreshEnvironment();

    const latestStoreState = useConversationStore.getState();
    if (!latestStoreState.voiceprintEnabled) {
      showAlert({
        title: t('dev.voiceprintDebug.alerts.unavailableTitle'),
        message: t('dev.voiceprintDebug.alerts.unavailableBody'),
      });
      return;
    }

    if (!latestStoreState.voiceprintEnrollmentReady) {
      showAlert({
        title: t('dev.voiceprintDebug.alerts.enrollmentMissingTitle'),
        message: t('dev.voiceprintDebug.alerts.enrollmentMissingBody'),
      });
      return;
    }

    const granted = await AudioEngine.requestPermission();
    if (!granted) {
      showAlert({
        title: t('dev.voiceprintDebug.alerts.permissionDeniedTitle'),
        message: t('dev.voiceprintDebug.alerts.permissionDeniedBody'),
      });
      return;
    }

    await audioEngine.init();
    voiceprintService.resetSessionState();
    voiceprintService.startSessionAnalysis();

    samplesRef.current = [];
    setSamples([]);
    setLastRunSummary(null);
    setChunkCount(0);
    setElapsedMs(0);
    setIsRecording(true);
    startTimeRef.current = Date.now();

    clearSnapshotTimer();
    snapshotTimerRef.current = setInterval(() => {
      const startedAt = startTimeRef.current;
      if (!startedAt) {
        return;
      }

      setElapsedMs(Date.now() - startedAt);
      appendSnapshot(voiceprintService.getCurrentDecision());
    }, SNAPSHOT_INTERVAL_MS);

    await audioEngine.start((base64Chunk: string) => {
      setChunkCount((current) => current + 1);
      voiceprintService.ingestChunk(base64Chunk);
    });
  }, [
    appendSnapshot,
    clearSnapshotTimer,
    refreshEnvironment,
    t,
  ]);

  const handlePrimaryAction = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }

    try {
      await startRecording();
    } catch (error) {
      clearSnapshotTimer();
      setIsRecording(false);
      voiceprintService.stopSessionAnalysis();
      try {
        await audioEngine.stop();
      } catch {}
      showAlert({
        title: t('dev.voiceprintDebug.alerts.startFailedTitle'),
        message:
          error instanceof Error
            ? error.message
            : t('dev.voiceprintDebug.alerts.startFailedBody'),
      });
    }
  }, [clearSnapshotTimer, isRecording, startRecording, stopRecording, t]);

  const clearResults = useCallback(() => {
    samplesRef.current = [];
    setSamples([]);
    setLastRunSummary(null);
    setElapsedMs(0);
    setChunkCount(0);
    voiceprintService.resetSessionState();
  }, []);

  useEffect(() => {
    void refreshEnvironment();
  }, [refreshEnvironment]);

  useEffect(() => {
    return () => {
      clearSnapshotTimer();
      voiceprintService.stopSessionAnalysis();
      void audioEngine.stop().catch(() => {});
    };
  }, [clearSnapshotTimer]);

  const decisionTone = useMemo(
    () => getDecisionTone(lastVoiceprintDecision),
    [lastVoiceprintDecision],
  );
  const lastSamples = useMemo(() => samples.slice(-8).reverse(), [samples]);
  const summaryTone = useMemo(
    () => getDecisionTone(lastRunSummary?.dominantLabel ?? null),
    [lastRunSummary],
  );
  const testModeConfig = useMemo<TestModeConfig>(() => {
    if (expectedSpeaker === 'self') {
      return {
        title: t('dev.voiceprintDebug.modeSelfTitle'),
        description: t('dev.voiceprintDebug.modeSelfDescription'),
        instruction: t('dev.voiceprintDebug.modeSelfInstruction'),
      };
    }

    return {
      title: t('dev.voiceprintDebug.modeOtherTitle'),
      description: t('dev.voiceprintDebug.modeOtherDescription'),
      instruction: t('dev.voiceprintDebug.modeOtherInstruction'),
    };
  }, [expectedSpeaker, t]);
  const baselineStatusText = useMemo(() => {
    if (!enrollmentMeta) {
      return '--';
    }
    if (enrollmentMeta.availability === 'ready') {
      return t('dev.voiceprintDebug.baselineReady');
    }
    if (enrollmentMeta.availability === 'legacy_pcm_only') {
      return t('dev.voiceprintDebug.baselineLegacy');
    }
    return t('dev.voiceprintDebug.baselineMissing');
  }, [enrollmentMeta, t]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>{t('dev.voiceprintDebug.title')}</Text>
          <Text style={styles.subtitle}>{t('dev.voiceprintDebug.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.baselineTitle')}</Text>
          <Text style={styles.cardBody}>{t('dev.voiceprintDebug.baselineBody')}</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('dev.voiceprintDebug.metrics.baseline')}</Text>
              <Text style={styles.metricValue}>{baselineStatusText}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('dev.voiceprintDebug.metrics.baselineMeaning')}
              </Text>
              <Text style={styles.metricValue}>
                {t('dev.voiceprintDebug.baselineMeaningValue')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.quickCheckTitle')}</Text>
          <Text style={styles.cardBody}>{t('dev.voiceprintDebug.quickCheckBody')}</Text>
          <View style={styles.tipList}>
            <Text style={styles.tipItem}>{t('dev.voiceprintDebug.quickCheckSelf')}</Text>
            <Text style={styles.tipItem}>{t('dev.voiceprintDebug.quickCheckOther')}</Text>
            <Text style={styles.tipItem}>{t('dev.voiceprintDebug.quickCheckRead')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.environmentTitle')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refreshEnvironment()}
              style={[styles.smallButton, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>
                {isRefreshing
                  ? t('dev.voiceprintDebug.refreshing')
                  : t('dev.voiceprintDebug.refresh')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('dev.voiceprintDebug.metrics.native')}</Text>
              <Text style={styles.metricValue}>{voiceprintEnabled ? 'yes' : 'no'}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('dev.voiceprintDebug.metrics.enrollment')}
              </Text>
              <Text style={styles.metricValue}>
                {enrollmentMeta?.availability ?? '--'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('dev.voiceprintDebug.metrics.model')}</Text>
              <Text style={styles.metricValue}>{enrollmentMeta?.profileModel ?? '--'}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('dev.voiceprintDebug.metrics.duration')}</Text>
              <Text style={styles.metricValue}>
                {formatDurationMs(enrollmentMeta?.profileDurationMs ?? null)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.testModeTitle')}</Text>
          <Text style={styles.cardBody}>{t('dev.voiceprintDebug.testModeBody')}</Text>
          <View style={styles.segmentedRow}>
            {(['self', 'other'] as const).map((speaker) => {
              const active = expectedSpeaker === speaker;
              return (
                <Pressable
                  key={speaker}
                  onPress={() => setExpectedSpeaker(speaker)}
                  style={[
                    styles.segmentButton,
                    active && styles.segmentButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      active && styles.segmentButtonTextActive,
                    ]}
                  >
                    {speaker === 'self'
                      ? t('dev.voiceprintDebug.expectedSelf')
                      : t('dev.voiceprintDebug.expectedOther')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.modeHintCard}>
            <Text style={styles.modeHintTitle}>{testModeConfig.title}</Text>
            <Text style={styles.modeHintBody}>{testModeConfig.description}</Text>
            <Text style={styles.modeHintInstruction}>{testModeConfig.instruction}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => void handlePrimaryAction()}
              style={[
                styles.button,
                isRecording ? styles.dangerButton : styles.primaryButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isRecording
                  ? t('dev.voiceprintDebug.stopAction')
                  : t('dev.voiceprintDebug.startAction')}
              </Text>
            </Pressable>
            <Pressable
              onPress={clearResults}
              style={[styles.button, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>
                {t('dev.voiceprintDebug.clearAction')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('dev.voiceprintDebug.metrics.elapsed')}</Text>
              <Text style={styles.metricValue}>{formatDurationMs(elapsedMs)}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('dev.voiceprintDebug.metrics.chunks')}</Text>
              <Text style={styles.metricValue}>{chunkCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.liveMetricsTitle')}</Text>
          <View
            style={[
              styles.decisionBadge,
              {
                backgroundColor: decisionTone.backgroundColor,
                borderColor: decisionTone.borderColor,
              },
            ]}
          >
            <Text style={[styles.decisionText, { color: decisionTone.textColor }]}>
              {lastVoiceprintDecision ?? '--'}
            </Text>
          </View>
          <View style={styles.metricGrid}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('dev.voiceprintDebug.metrics.similarity')}
              </Text>
              <Text style={styles.metricValue}>{formatSimilarity(lastVoiceprintSimilarity)}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('dev.voiceprintDebug.metrics.thresholdBand')}
              </Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintThresholdLow != null && lastVoiceprintThresholdHigh != null
                  ? `${lastVoiceprintThresholdLow.toFixed(2)} -> ${lastVoiceprintThresholdHigh.toFixed(2)}`
                  : '--'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('dev.voiceprintDebug.metrics.confidenceReason')}
              </Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintConfidence && lastVoiceprintReason
                  ? `${lastVoiceprintConfidence} · ${lastVoiceprintReason}`
                  : '--'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('dev.voiceprintDebug.metrics.modelBucket')}
              </Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintInputDurationMs != null
                  ? `${Math.round(lastVoiceprintInputDurationMs / 1000)}s / ${lastVoiceprintMelFrameCount ?? '--'}f`
                  : '--'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.summaryTitle')}</Text>
          {lastRunSummary ? (
            <>
              <View
                style={[
                  styles.decisionBadge,
                  styles.summaryBadge,
                  {
                    backgroundColor: summaryTone.backgroundColor,
                    borderColor: summaryTone.borderColor,
                  },
                ]}
              >
                <Text style={[styles.decisionText, { color: summaryTone.textColor }]}>
                  {lastRunSummary.matchedExpected == null
                    ? t('dev.voiceprintDebug.summaryUnknown')
                    : lastRunSummary.matchedExpected
                      ? t('dev.voiceprintDebug.summaryMatch')
                      : t('dev.voiceprintDebug.summaryMismatch')}
                </Text>
              </View>
              <View style={styles.metricGrid}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>
                    {t('dev.voiceprintDebug.metrics.dominantLabel')}
                  </Text>
                  <Text style={styles.metricValue}>{lastRunSummary.dominantLabel}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>
                    {t('dev.voiceprintDebug.metrics.matchRate')}
                  </Text>
                  <Text style={styles.metricValue}>
                    {formatPercent(lastRunSummary.expectedHitRate)}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>
                    {t('dev.voiceprintDebug.metrics.stableSamples')}
                  </Text>
                  <Text style={styles.metricValue}>{lastRunSummary.stableSampleCount}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>
                    {t('dev.voiceprintDebug.metrics.unknownSamples')}
                  </Text>
                  <Text style={styles.metricValue}>{lastRunSummary.unknownSampleCount}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>
                    {t('dev.voiceprintDebug.metrics.averageSimilarity')}
                  </Text>
                  <Text style={styles.metricValue}>
                    {formatSimilarity(lastRunSummary.averageSimilarity)}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>
                    {t('dev.voiceprintDebug.metrics.range')}
                  </Text>
                  <Text style={styles.metricValue}>
                    {`${formatSimilarity(lastRunSummary.floorSimilarity)} -> ${formatSimilarity(lastRunSummary.peakSimilarity)}`}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>{t('dev.voiceprintDebug.summaryEmpty')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dev.voiceprintDebug.timelineTitle')}</Text>
          {lastSamples.length > 0 ? (
            lastSamples.map((sample) => {
              const tone = getDecisionTone(sample.label);
              return (
                <View key={sample.takenAt} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelinePill,
                      {
                        backgroundColor: tone.backgroundColor,
                        borderColor: tone.borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.timelinePillText, { color: tone.textColor }]}>
                      {sample.label}
                    </Text>
                  </View>
                  <Text style={styles.timelineText}>
                    {`sim ${formatSimilarity(sample.similarity)} · ${sample.confidence} · ${sample.reason}`}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>{t('dev.voiceprintDebug.timelineEmpty')}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  title: {
    ...typography.displayLg,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.bodyMd,
    color: palette.textSecondary,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  cardBody: {
    ...typography.bodyMd,
    color: palette.textSecondary,
  },
  tipList: {
    gap: spacing.sm,
  },
  tipItem: {
    ...typography.bodySm,
    color: palette.textPrimary,
    lineHeight: 20,
  },
  modeHintCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: 'rgba(255,255,255,0.52)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  modeHintTitle: {
    ...typography.bodyMd,
    color: palette.textPrimary,
    fontWeight: '700',
  },
  modeHintBody: {
    ...typography.bodySm,
    color: palette.textSecondary,
    lineHeight: 20,
  },
  modeHintInstruction: {
    ...typography.bodySm,
    color: palette.textPrimary,
    lineHeight: 20,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accentDark,
  },
  segmentButtonText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  segmentButtonTextActive: {
    color: palette.textOnAccent,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: palette.accent,
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  secondaryButton: {
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  primaryButtonText: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: palette.textOnAccent,
  },
  secondaryButtonText: {
    ...typography.bodyMd,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  metricGrid: {
    gap: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metricLabel: {
    flex: 1,
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  metricValue: {
    ...typography.bodySm,
    fontWeight: '700',
    color: palette.textPrimary,
    textAlign: 'right',
  },
  decisionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  summaryBadge: {
    marginBottom: spacing.xs,
  },
  decisionText: {
    ...typography.labelLg,
  },
  emptyText: {
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelinePill: {
    minWidth: 72,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  timelinePillText: {
    ...typography.labelMd,
  },
  timelineText: {
    flex: 1,
    ...typography.bodySm,
    color: palette.textPrimary,
  },
});

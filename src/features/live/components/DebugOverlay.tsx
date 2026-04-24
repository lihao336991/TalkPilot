import React from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversationStore } from '../store/conversationStore';
import { deepgramTokenService } from '@/features/live/services/DeepgramTokenService';
import { resetFreeAccessDebug } from '@/shared/repositories/billingRepository';
import { getDeepgramLanguageForTag } from '@/shared/locale/deviceLanguage';
import { useLocaleStore } from '@/shared/store/localeStore';
import { useTranslation } from 'react-i18next';
import { useDebugStore, type DebugTurnTrace } from '../store/debugStore';

function StatusIcon({ status }: { status: 'running' | 'done' | 'error' }) {
  if (status === 'done') return <Text style={styles.iconDone}>✅</Text>;
  if (status === 'error') return <Text style={styles.iconError}>❌</Text>;
  return <Text style={styles.iconRunning}>⏳</Text>;
}

function formatDurationMs(ms?: number) {
  if (ms === undefined || Number.isNaN(ms)) {
    return '--';
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

function formatSimilarity(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return value.toFixed(3);
}

function formatThresholdDistance(
  similarity: number | null,
  threshold: number | null,
) {
  if (similarity == null || threshold == null) {
    return '--';
  }

  const delta = similarity - threshold;
  const prefix = delta >= 0 ? '+' : '';
  return `${prefix}${delta.toFixed(3)}`;
}

function buildCollapsedLabel(
  latestStep: ReturnType<typeof useDebugStore.getState>['steps'][number] | undefined,
  latestTrace: DebugTurnTrace | undefined,
  languageSummary: string,
) {
  if (latestStep) {
    return latestStep.label;
  }

  if (!latestTrace) {
    return languageSummary;
  }

  return `Turn ${latestTrace.turnId.slice(-4)} ${latestTrace.llmKind ?? 'asr'}`;
}

function getTraceStatus(trace: DebugTurnTrace): 'running' | 'done' | 'error' {
  if (trace.llmStatus === 'error') return 'error';
  if (trace.llmStatus === 'done') return 'done';
  return 'running';
}

function getCollapsedStatus(
  latestStep: ReturnType<typeof useDebugStore.getState>['steps'][number] | undefined,
  latestTrace: DebugTurnTrace | undefined,
): 'running' | 'done' | 'error' {
  if (latestStep) {
    return latestStep.status;
  }

  if (latestTrace) {
    return getTraceStatus(latestTrace);
  }

  return 'running';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function TraceCard({ trace }: { trace: DebugTurnTrace }) {
  const asrLatency =
    trace.asrFinalAt !== undefined
      ? trace.asrFinalAt - trace.recordingStartedAt
      : undefined;
  const utteranceGap =
    trace.utteranceEndAt !== undefined && trace.asrFinalAt !== undefined
      ? trace.utteranceEndAt - trace.asrFinalAt
      : undefined;
  const llmLatency =
    trace.llmCompletedAt !== undefined && trace.llmStartedAt !== undefined
      ? trace.llmCompletedAt - trace.llmStartedAt
      : undefined;
  const totalLatency =
    trace.llmCompletedAt !== undefined
      ? trace.llmCompletedAt - trace.recordingStartedAt
      : trace.asrFinalAt !== undefined
        ? trace.asrFinalAt - trace.recordingStartedAt
        : undefined;

  return (
    <View style={styles.traceCard}>
      <View style={styles.traceHeader}>
        <View style={styles.traceHeaderLeft}>
          <StatusIcon status={getTraceStatus(trace)} />
          <Text style={styles.traceTitle}>
            {trace.speaker === 'self' ? '我方' : '对方'} · Turn {trace.turnId.slice(-4)}
          </Text>
        </View>
        <Text style={styles.traceKind}>
          {trace.llmKind === 'review'
            ? 'Review'
            : trace.llmKind === 'suggest'
              ? 'Suggest'
              : 'ASR'}
        </Text>
      </View>

      <Text style={styles.tracePreview} numberOfLines={2}>
        {trace.textPreview || 'No transcript'}
      </Text>

      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>录音 -&gt; ASR</Text>
        <Text style={styles.metricValue}>{formatDurationMs(asrLatency)}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>ASR -&gt; UtteranceEnd</Text>
        <Text style={styles.metricValue}>{formatDurationMs(utteranceGap)}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>LLM 耗时</Text>
        <Text style={styles.metricValue}>
          {trace.llmStatus === 'idle'
            ? '未触发'
            : trace.llmStatus === 'running'
              ? '进行中'
              : formatDurationMs(llmLatency)}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>总耗时</Text>
        <Text style={styles.metricValue}>{formatDurationMs(totalLatency)}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>声纹相似度</Text>
        <Text style={styles.metricValue}>
          {trace.voiceprintSimilarity != null
            ? trace.voiceprintSimilarity.toFixed(3)
            : '--'}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>声纹判定</Text>
        <Text style={styles.metricValue}>
          {trace.voiceprintDecision ?? '--'}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>来源</Text>
        <Text style={styles.metricValue}>
          {trace.speakerDecisionSource ?? '--'}
        </Text>
      </View>

      {trace.llmDetail ? (
        <Text
          style={[
            styles.traceDetail,
            trace.llmStatus === 'error' && styles.traceDetailError,
          ]}
        >
          {trace.llmDetail}
        </Text>
      ) : null}
    </View>
  );
}

function DebugOverlayContent() {
  const { t } = useTranslation();
  const steps = useDebugStore((s) => s.steps);
  const turnTraces = useDebugStore((s) => s.turnTraces);
  const uiLocale = useLocaleStore((s) => s.uiLocale);
  const learningLanguage = useLocaleStore((s) => s.learningLanguage);
  const voiceprintEnabled = useConversationStore((s) => s.voiceprintEnabled);
  const voiceprintEnrollmentReady = useConversationStore((s) => s.voiceprintEnrollmentReady);
  const lastVoiceprintSimilarity = useConversationStore((s) => s.lastVoiceprintSimilarity);
  const lastVoiceprintDecision = useConversationStore((s) => s.lastVoiceprintDecision);
  const lastVoiceprintConfidence = useConversationStore((s) => s.lastVoiceprintConfidence);
  const lastVoiceprintReason = useConversationStore((s) => s.lastVoiceprintReason);
  const lastVoiceprintThresholdHigh = useConversationStore((s) => s.lastVoiceprintThresholdHigh);
  const lastVoiceprintThresholdLow = useConversationStore((s) => s.lastVoiceprintThresholdLow);
  const lastVoiceprintInputDurationMs = useConversationStore((s) => s.lastVoiceprintInputDurationMs);
  const lastVoiceprintMelFrameCount = useConversationStore((s) => s.lastVoiceprintMelFrameCount);
  const lastSpeakerDecisionSource = useConversationStore((s) => s.lastSpeakerDecisionSource);
  const [collapsed, setCollapsed] = React.useState(true);
  const [isResettingFreeAccess, setIsResettingFreeAccess] = React.useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const hasDebugData = steps.length > 0 || turnTraces.length > 0;
  const latestStep = steps[steps.length - 1];
  const latestTrace = turnTraces[turnTraces.length - 1];
  const mainAsrLanguage = getDeepgramLanguageForTag(learningLanguage);
  const assistAsrLanguage = getDeepgramLanguageForTag(uiLocale);
  const languageSummary = `Main ${mainAsrLanguage} · Assist ${assistAsrLanguage}`;
  const defaultTop = Math.max(8, insets.top + 8);
  const dragStartTopRef = React.useRef(defaultTop);
  const dragMovedRef = React.useRef(false);
  const [overlayTop, setOverlayTop] = React.useState(defaultTop);
  const [collapsedHeight, setCollapsedHeight] = React.useState(44);
  const [expandedHeight, setExpandedHeight] = React.useState(420);

  const getMaxTop = React.useCallback(
    (overlayHeight: number) =>
      Math.max(defaultTop, windowHeight - insets.bottom - overlayHeight - 12),
    [defaultTop, insets.bottom, windowHeight],
  );

  const clampTop = React.useCallback(
    (nextTop: number, overlayHeight: number) =>
      clamp(nextTop, defaultTop, getMaxTop(overlayHeight)),
    [defaultTop, getMaxTop],
  );

  React.useEffect(() => {
    setOverlayTop((currentTop) =>
      clampTop(currentTop, collapsed ? collapsedHeight : expandedHeight),
    );
  }, [clampTop, collapsed, collapsedHeight, expandedHeight]);

  React.useEffect(() => {
    dragStartTopRef.current = overlayTop;
  }, [overlayTop]);

  const updateOverlayTop = React.useCallback(
    (dy: number, overlayHeight: number) => {
      const nextTop = clampTop(dragStartTopRef.current + dy, overlayHeight);
      setOverlayTop(nextTop);
    },
    [clampTop],
  );

  const collapsedPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          dragStartTopRef.current = overlayTop;
          dragMovedRef.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dy) > 3) {
            dragMovedRef.current = true;
          }
          updateOverlayTop(gestureState.dy, collapsedHeight);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!dragMovedRef.current && Math.abs(gestureState.dy) < 4) {
            setCollapsed(false);
          }
          dragStartTopRef.current = clampTop(
            dragStartTopRef.current + gestureState.dy,
            collapsedHeight,
          );
          dragMovedRef.current = false;
        },
        onPanResponderTerminate: (_, gestureState) => {
          dragStartTopRef.current = clampTop(
            dragStartTopRef.current + gestureState.dy,
            collapsedHeight,
          );
          dragMovedRef.current = false;
        },
      }),
    [clampTop, collapsedHeight, overlayTop, updateOverlayTop],
  );

  const dragHandlePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          dragStartTopRef.current = overlayTop;
        },
        onPanResponderMove: (_, gestureState) => {
          updateOverlayTop(gestureState.dy, expandedHeight);
        },
        onPanResponderRelease: (_, gestureState) => {
          dragStartTopRef.current = clampTop(
            dragStartTopRef.current + gestureState.dy,
            expandedHeight,
          );
        },
        onPanResponderTerminate: (_, gestureState) => {
          dragStartTopRef.current = clampTop(
            dragStartTopRef.current + gestureState.dy,
            expandedHeight,
          );
        },
      }),
    [clampTop, expandedHeight, overlayTop, updateOverlayTop],
  );

  const handleResetFreeAccess = React.useCallback(async () => {
    if (isResettingFreeAccess) {
      return;
    }

    setIsResettingFreeAccess(true);

    try {
      deepgramTokenService.invalidate();
      await resetFreeAccessDebug();
      Alert.alert(
        t('settings.debug.resetFreeAccessAction'),
        t('settings.debug.resetFreeAccessSuccess'),
      );
    } catch (error) {
      Alert.alert(
        t('settings.debug.resetFreeAccessAction'),
        error instanceof Error
          ? error.message
          : t('settings.debug.resetFreeAccessFailure'),
      );
    } finally {
      setIsResettingFreeAccess(false);
    }
  }, [isResettingFreeAccess, t]);

  if (collapsed) {
    return (
      <View
        {...collapsedPanResponder.panHandlers}
        style={[styles.collapsedPill, { top: overlayTop }]}
        onLayout={(event) => {
          setCollapsedHeight(event.nativeEvent.layout.height);
        }}
      >
        <StatusIcon status={getCollapsedStatus(latestStep, latestTrace)} />
        <Text style={styles.collapsedTitle}>Live 调试</Text>
        <Text style={styles.collapsedLabel} numberOfLines={1}>
          {buildCollapsedLabel(latestStep, latestTrace, languageSummary)}
        </Text>
        <Text style={styles.collapsedAction}>展开</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { top: overlayTop }]}
      onLayout={(event) => {
        setExpandedHeight(event.nativeEvent.layout.height);
      }}
    >
      <View {...dragHandlePanResponder.panHandlers} style={styles.dragHandleWrap}>
        <View style={styles.dragHandle} />
      </View>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>主流程调试</Text>
          <Text style={styles.inlineHint}>可上下拖动，默认收起</Text>
        </View>
        <Pressable
          onPress={() => setCollapsed(true)}
          accessibilityRole="button"
          accessibilityLabel="收起调试面板"
          hitSlop={16}
        >
          <Text style={styles.headerAction}>收起</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} nestedScrollEnabled>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>语言</Text>
          <View style={styles.languageCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>App / 母语</Text>
              <Text style={styles.metricValue}>{uiLocale}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Learning</Text>
              <Text style={styles.metricValue}>{learningLanguage}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Main ASR</Text>
              <Text style={styles.metricValue}>{mainAsrLanguage}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Assist ASR</Text>
              <Text style={styles.metricValue}>{assistAsrLanguage}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调试工具</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isResettingFreeAccess}
            onPress={() => {
              void handleResetFreeAccess();
            }}
            style={[
              styles.toolButton,
              isResettingFreeAccess && styles.toolButtonDisabled,
            ]}
          >
            <Text style={styles.toolButtonText}>
              {isResettingFreeAccess
                ? t('settings.debug.resetFreeAccessBusy')
                : t('settings.debug.resetFreeAccessAction')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>声纹</Text>
          <View style={styles.languageCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Native ready</Text>
              <Text style={styles.metricValue}>{voiceprintEnabled ? 'yes' : 'no'}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Enrollment ready</Text>
              <Text style={styles.metricValue}>
                {voiceprintEnrollmentReady ? 'yes' : 'no'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Last similarity</Text>
              <Text style={styles.metricValue}>
                {formatSimilarity(lastVoiceprintSimilarity)}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Threshold band</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintThresholdLow != null && lastVoiceprintThresholdHigh != null
                  ? `${lastVoiceprintThresholdLow.toFixed(2)} -> ${lastVoiceprintThresholdHigh.toFixed(2)}`
                  : '--'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>To self gate</Text>
              <Text style={styles.metricValue}>
                {formatThresholdDistance(
                  lastVoiceprintSimilarity,
                  lastVoiceprintThresholdHigh,
                )}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>To other gate</Text>
              <Text style={styles.metricValue}>
                {formatThresholdDistance(
                  lastVoiceprintSimilarity,
                  lastVoiceprintThresholdLow,
                )}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Last decision</Text>
              <Text style={styles.metricValue}>{lastVoiceprintDecision ?? '--'}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Confidence / reason</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintConfidence && lastVoiceprintReason
                  ? `${lastVoiceprintConfidence} · ${lastVoiceprintReason}`
                  : '--'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Model bucket</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintInputDurationMs != null
                  ? `${Math.round(lastVoiceprintInputDurationMs / 1000)}s / ${lastVoiceprintMelFrameCount ?? '--'}f`
                  : '--'}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Speaker source</Text>
              <Text style={styles.metricValue}>
                {lastSpeakerDecisionSource ?? '--'}
              </Text>
            </View>
          </View>
        </View>

        {!hasDebugData ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>等待连接与转写链路数据</Text>
            <Text style={styles.emptyBody}>
              进入 Live 页后会先预建主 WS，开始对话后这里会继续显示 ASR、LLM 和 assist 的状态。
            </Text>
          </View>
        ) : null}

        {steps.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>主流程</Text>
            {steps.map((step) => (
              <View key={step.key} style={styles.row}>
                <StatusIcon status={step.status} />
                <View style={styles.textContainer}>
                  <View style={styles.stepHeader}>
                    <Text
                      style={[
                        styles.label,
                        step.status === 'done' && styles.labelDone,
                        step.status === 'error' && styles.labelError,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {step.completedAt ? (
                      <Text style={styles.stepDuration}>
                        {formatDurationMs(step.completedAt - step.timestamp)}
                      </Text>
                    ) : null}
                  </View>
                  {step.detail ? (
                    <Text
                      style={[
                        styles.detail,
                        step.status === 'error' && styles.detailError,
                      ]}
                      numberOfLines={3}
                    >
                      {step.detail}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {turnTraces.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>每轮链路耗时</Text>
            {[...turnTraces].reverse().map((trace) => (
              <TraceCard key={trace.turnId} trace={trace} />
            ))}
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

export function DebugOverlay() {
  if (!__DEV__) return null;
  return <DebugOverlayContent />;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 18,
    maxHeight: 420,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collapsedPill: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  collapsedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  collapsedLabel: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
  },
  collapsedAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60A5FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  headerAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60A5FA',
  },
  inlineHint: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.58)',
  },
  emptyState: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.62)',
  },
  scroll: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  iconDone: {
    fontSize: 14,
    marginTop: 1,
  },
  iconError: {
    fontSize: 14,
    marginTop: 1,
  },
  iconRunning: {
    fontSize: 14,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepDuration: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  labelDone: {
    color: '#4ADE80',
  },
  labelError: {
    color: '#F87171',
  },
  detail: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  detailError: {
    color: '#FCA5A5',
  },
  traceCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  traceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  traceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  traceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  traceKind: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93C5FD',
    textTransform: 'uppercase',
  },
  tracePreview: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.72)',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
  },
  traceDetail: {
    marginTop: 8,
    fontSize: 11,
    color: '#86EFAC',
  },
  traceDetailError: {
    color: '#FCA5A5',
  },
  languageCard: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolButton: {
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96,165,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.42)',
    paddingHorizontal: 12,
  },
  toolButtonDisabled: {
    opacity: 0.6,
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BFDBFE',
  },
});

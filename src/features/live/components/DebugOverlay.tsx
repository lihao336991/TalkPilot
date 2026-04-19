import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function buildCollapsedLabel(
  latestStep: ReturnType<typeof useDebugStore.getState>['steps'][number] | undefined,
  latestTrace: DebugTurnTrace | undefined,
) {
  if (latestStep) {
    return latestStep.label;
  }

  if (!latestTrace) {
    return '暂无调试数据';
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

type DebugPanelProps = {
  inline?: boolean;
};

function DebugOverlayContent({ inline = false }: DebugPanelProps) {
  const steps = useDebugStore((s) => s.steps);
  const turnTraces = useDebugStore((s) => s.turnTraces);
  const [collapsed, setCollapsed] = React.useState(false);
  const insets = useSafeAreaInsets();
  const hasDebugData = steps.length > 0 || turnTraces.length > 0;

  if (!inline && !hasDebugData) return null;

  const latestStep = steps[steps.length - 1];
  const latestTrace = turnTraces[turnTraces.length - 1];

  if (collapsed) {
    return (
      <Pressable
        style={
          inline
            ? styles.inlineCollapsedPill
            : [styles.collapsedPill, { top: Math.max(8, insets.top + 8) }]
        }
        onPress={() => setCollapsed(false)}
      >
        <StatusIcon status={getCollapsedStatus(latestStep, latestTrace)} />
        <Text style={styles.collapsedTitle}>
          {inline ? "Live 调试" : "主流程调试"}
        </Text>
        <Text style={styles.collapsedLabel} numberOfLines={1}>
          {buildCollapsedLabel(latestStep, latestTrace)}
        </Text>
        <Text style={styles.collapsedAction}>展开</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        inline ? styles.inlineContainer : styles.container,
        !inline && { top: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>主流程调试</Text>
        {!inline ? (
          <Pressable
            onPress={() => setCollapsed(true)}
            accessibilityRole="button"
            accessibilityLabel="隐藏调试面板"
            hitSlop={16}
          >
            <Text style={styles.headerAction}>隐藏</Text>
          </Pressable>
        ) : (
          <View style={styles.inlineHeaderRight}>
            <Text style={styles.inlineHint}>Live 页面实时展示</Text>
            <Pressable
              onPress={() => setCollapsed(true)}
              accessibilityRole="button"
              accessibilityLabel="收起调试面板"
              hitSlop={16}
            >
              <Text style={styles.headerAction}>收起</Text>
            </Pressable>
          </View>
        )}
      </View>
      <ScrollView style={styles.scroll} nestedScrollEnabled>
        {!hasDebugData && inline ? (
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

export function DebugOverlay(props: DebugPanelProps) {
  if (!__DEV__) return null;
  return <DebugOverlayContent {...props} />;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    maxHeight: 420,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inlineContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    maxHeight: 320,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collapsedPill: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 9999,
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineCollapsedPill: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  inlineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyState: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
});

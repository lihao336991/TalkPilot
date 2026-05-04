import { deepgramTokenService } from "@/features/live/services/DeepgramTokenService";
import { DEBUG_LLM_MODEL_OPTIONS } from "@/shared/llm/debugConfig";
import { getDeepgramLanguageForTag } from "@/shared/locale/deviceLanguage";
import { resetFreeAccessDebug } from "@/shared/repositories/billingRepository";
import { useLlmDebugStore } from "@/shared/store/llmDebugStore";
import { useLocaleStore } from "@/shared/store/localeStore";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConversationStore } from "../store/conversationStore";
import { useDebugStore, type DebugTurnTrace } from "../store/debugStore";

function StatusIcon({ status }: { status: "running" | "done" | "error" }) {
  if (status === "done") return <Text style={styles.iconDone}>✅</Text>;
  if (status === "error") return <Text style={styles.iconError}>❌</Text>;
  return <Text style={styles.iconRunning}>⏳</Text>;
}

function formatDurationMs(ms?: number) {
  if (ms === undefined || Number.isNaN(ms)) {
    return "--";
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

function formatSimilarity(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(3);
}

function formatThresholdDistance(
  similarity: number | null,
  threshold: number | null,
) {
  if (similarity == null || threshold == null) {
    return "--";
  }

  const delta = similarity - threshold;
  const prefix = delta >= 0 ? "+" : "";
  return `${prefix}${delta.toFixed(3)}`;
}

function buildCollapsedLabel(
  latestStep:
    | ReturnType<typeof useDebugStore.getState>["steps"][number]
    | undefined,
  latestTrace: DebugTurnTrace | undefined,
  languageSummary: string,
) {
  if (latestStep) {
    return latestStep.label;
  }

  if (!latestTrace) {
    return languageSummary;
  }

  return `Turn ${latestTrace.turnId.slice(-4)} ${latestTrace.llmKind ?? "asr"}`;
}

function getTraceStatus(trace: DebugTurnTrace): "running" | "done" | "error" {
  if (trace.translationStatus === "error") return "error";
  if (trace.translationStatus === "running") return "running";
  if (trace.llmStatus === "error") return "error";
  if (trace.llmStatus === "done") return "done";
  if (trace.translationStatus === "done") return "done";
  return "running";
}

function getCollapsedStatus(
  latestStep:
    | ReturnType<typeof useDebugStore.getState>["steps"][number]
    | undefined,
  latestTrace: DebugTurnTrace | undefined,
): "running" | "done" | "error" {
  if (latestStep) {
    return latestStep.status;
  }

  if (latestTrace) {
    return getTraceStatus(latestTrace);
  }

  return "running";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.optionChip, selected && styles.optionChipSelected]}
    >
      <Text
        style={[
          styles.optionChipText,
          selected && styles.optionChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
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
  const translationLatency =
    trace.translationCompletedAt !== undefined &&
    trace.translationStartedAt !== undefined
      ? trace.translationCompletedAt - trace.translationStartedAt
      : undefined;
  const totalLatency =
    trace.llmCompletedAt !== undefined ||
    trace.translationCompletedAt !== undefined
      ? Math.max(
          trace.llmCompletedAt ?? trace.recordingStartedAt,
          trace.translationCompletedAt ?? trace.recordingStartedAt,
        ) - trace.recordingStartedAt
      : trace.asrFinalAt !== undefined
        ? trace.asrFinalAt - trace.recordingStartedAt
        : undefined;

  return (
    <View style={styles.traceCard}>
      <View style={styles.traceHeader}>
        <View style={styles.traceHeaderLeft}>
          <StatusIcon status={getTraceStatus(trace)} />
          <Text style={styles.traceTitle}>
            {trace.speaker === "self" ? "我方" : "对方"} · 轮次{" "}
            {trace.turnId.slice(-4)}
          </Text>
        </View>
        <Text style={styles.traceKind}>
          {trace.llmKind === "review"
            ? "复盘"
            : trace.llmKind === "suggest"
              ? "建议"
              : "转写"}
        </Text>
      </View>

      <Text style={styles.tracePreview} numberOfLines={2}>
        {trace.textPreview || "暂无转写"}
      </Text>

      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>录音 -&gt; 转写</Text>
        <Text style={styles.metricValue}>{formatDurationMs(asrLatency)}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>转写 -&gt; 句末判断</Text>
        <Text style={styles.metricValue}>{formatDurationMs(utteranceGap)}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>大模型耗时</Text>
        <Text style={styles.metricValue}>
          {trace.llmStatus === "idle"
            ? "未触发"
            : trace.llmStatus === "running"
              ? "进行中"
              : formatDurationMs(llmLatency)}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>翻译耗时</Text>
        <Text style={styles.metricValue}>
          {trace.translationStatus === "idle"
            ? "未触发"
            : trace.translationStatus === "running"
              ? "进行中"
              : formatDurationMs(translationLatency)}
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
            : "--"}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>声纹判定</Text>
        <Text style={styles.metricValue}>
          {trace.voiceprintDecision ?? "--"}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>来源</Text>
        <Text style={styles.metricValue}>
          {trace.speakerDecisionSource ?? "--"}
        </Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>Deepgram speakerId</Text>
        <Text style={styles.metricValue}>
          {trace.deepgramSpeakerId != null
            ? String(trace.deepgramSpeakerId)
            : "--"}
        </Text>
      </View>

      {trace.llmDetail ? (
        <Text
          style={[
            styles.traceDetail,
            trace.llmStatus === "error" && styles.traceDetailError,
          ]}
        >
          {trace.llmDetail}
        </Text>
      ) : null}
      {trace.translationDetail ? (
        <Text
          style={[
            styles.traceDetail,
            trace.translationStatus === "error" && styles.traceDetailError,
          ]}
        >
          {trace.translationDetail}
        </Text>
      ) : null}
    </View>
  );
}

type DebugOverlayProps = {
  onRestartMainMicrophone?: () => Promise<void> | void;
};

function DebugOverlayContent({ onRestartMainMicrophone }: DebugOverlayProps) {
  const { t } = useTranslation();
  const steps = useDebugStore((s) => s.steps);
  const turnTraces = useDebugStore((s) => s.turnTraces);
  const uiLocale = useLocaleStore((s) => s.uiLocale);
  const learningLanguage = useLocaleStore((s) => s.learningLanguage);
  const voiceprintEnabled = useConversationStore((s) => s.voiceprintEnabled);
  const voiceprintEnrollmentReady = useConversationStore(
    (s) => s.voiceprintEnrollmentReady,
  );
  const lastVoiceprintSimilarity = useConversationStore(
    (s) => s.lastVoiceprintSimilarity,
  );
  const lastVoiceprintDecision = useConversationStore(
    (s) => s.lastVoiceprintDecision,
  );
  const lastVoiceprintConfidence = useConversationStore(
    (s) => s.lastVoiceprintConfidence,
  );
  const lastVoiceprintReason = useConversationStore(
    (s) => s.lastVoiceprintReason,
  );
  const lastVoiceprintThresholdHigh = useConversationStore(
    (s) => s.lastVoiceprintThresholdHigh,
  );
  const lastVoiceprintThresholdLow = useConversationStore(
    (s) => s.lastVoiceprintThresholdLow,
  );
  const lastVoiceprintInputDurationMs = useConversationStore(
    (s) => s.lastVoiceprintInputDurationMs,
  );
  const lastVoiceprintMelFrameCount = useConversationStore(
    (s) => s.lastVoiceprintMelFrameCount,
  );
  const lastSpeakerDecisionSource = useConversationStore(
    (s) => s.lastSpeakerDecisionSource,
  );
  const llmRouteMode = useLlmDebugStore((s) => s.routeMode);
  const llmProvider = useLlmDebugStore((s) => s.provider);
  const llmModel = useLlmDebugStore((s) => s.model);
  const setLlmRouteMode = useLlmDebugStore((s) => s.setRouteMode);
  const setLlmProvider = useLlmDebugStore((s) => s.setProvider);
  const setLlmModel = useLlmDebugStore((s) => s.setModel);
  const [collapsed, setCollapsed] = React.useState(true);
  const [isResettingFreeAccess, setIsResettingFreeAccess] =
    React.useState(false);
  const [isRestartingMainMicrophone, setIsRestartingMainMicrophone] =
    React.useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const hasDebugData = steps.length > 0 || turnTraces.length > 0;
  const latestStep = steps[steps.length - 1];
  const latestTrace = turnTraces[turnTraces.length - 1];
  const mainAsrLanguage = getDeepgramLanguageForTag(learningLanguage);
  const assistAsrLanguage = getDeepgramLanguageForTag(uiLocale);
  const llmModelOptions = DEBUG_LLM_MODEL_OPTIONS[llmProvider];
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
        t("settings.debug.resetFreeAccessAction"),
        t("settings.debug.resetFreeAccessSuccess"),
      );
    } catch (error) {
      Alert.alert(
        t("settings.debug.resetFreeAccessAction"),
        error instanceof Error
          ? error.message
          : t("settings.debug.resetFreeAccessFailure"),
      );
    } finally {
      setIsResettingFreeAccess(false);
    }
  }, [isResettingFreeAccess, t]);

  const handleRestartMainMicrophone = React.useCallback(async () => {
    if (!onRestartMainMicrophone || isRestartingMainMicrophone) {
      return;
    }

    setIsRestartingMainMicrophone(true);
    try {
      await onRestartMainMicrophone();
    } finally {
      setIsRestartingMainMicrophone(false);
    }
  }, [isRestartingMainMicrophone, onRestartMainMicrophone]);

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
        <Text style={styles.collapsedTitle}>实时调试</Text>
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
      <View
        {...dragHandlePanResponder.panHandlers}
        style={styles.dragHandleWrap}
      >
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
              <Text style={styles.metricLabel}>界面 / 母语</Text>
              <Text style={styles.metricValue}>{uiLocale}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>学习语言</Text>
              <Text style={styles.metricValue}>{learningLanguage}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>主转写语言</Text>
              <Text style={styles.metricValue}>{mainAsrLanguage}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>救场转写语言</Text>
              <Text style={styles.metricValue}>{assistAsrLanguage}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("settings.debug.llmRoutingTitle")}
          </Text>
          <View style={styles.languageCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t("settings.debug.llmCurrentModeLabel")}
              </Text>
              <Text style={styles.metricValue}>
                {llmRouteMode === "auto"
                  ? t("settings.debug.llmModeAuto")
                  : t("settings.debug.llmModeManual")}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t("settings.debug.llmCurrentProviderLabel")}
              </Text>
              <Text style={styles.metricValue}>{llmProvider}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t("settings.debug.llmCurrentModelLabel")}
              </Text>
              <Text style={styles.metricValue}>{llmModel}</Text>
            </View>
            <Text style={styles.helperText}>
              {llmRouteMode === "auto"
                ? `${t("settings.debug.llmAutoHint")} ${t(
                    "settings.debug.llmManualSwitchHint",
                  )}`
                : t("settings.debug.llmRoutingDescription")}
            </Text>

            <Text style={styles.controlLabel}>
              {t("settings.debug.llmRoutingTitle")}
            </Text>
            <View style={styles.optionRow}>
              <OptionChip
                label={t("settings.debug.llmModeAuto")}
                selected={llmRouteMode === "auto"}
                onPress={() => setLlmRouteMode("auto")}
              />
              <OptionChip
                label={t("settings.debug.llmModeManual")}
                selected={llmRouteMode === "manual"}
                onPress={() => setLlmRouteMode("manual")}
              />
            </View>

            <Text style={styles.controlLabel}>
              {t("settings.debug.llmProviderTitle")}
            </Text>
            <View style={styles.optionRow}>
              <OptionChip
                label="Cerebras"
                selected={llmProvider === "cerebras"}
                onPress={() => setLlmProvider("cerebras")}
              />
              <OptionChip
                label="Groq"
                selected={llmProvider === "groq"}
                onPress={() => setLlmProvider("groq")}
              />
            </View>

            <Text style={styles.controlLabel}>
              {t("settings.debug.llmModelTitle")}
            </Text>
            <View style={styles.optionRow}>
              {llmModelOptions.map((option) => (
                <OptionChip
                  key={option.id}
                  label={option.label}
                  selected={llmModel === option.id}
                  onPress={() => setLlmModel(option.id)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调试工具</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!onRestartMainMicrophone || isRestartingMainMicrophone}
            onPress={() => {
              void handleRestartMainMicrophone();
            }}
            style={[
              styles.toolButton,
              styles.toolButtonStacked,
              (!onRestartMainMicrophone || isRestartingMainMicrophone) &&
                styles.toolButtonDisabled,
            ]}
          >
            <Text style={styles.toolButtonText}>
              {isRestartingMainMicrophone ? "正在重启主麦克风…" : "重启主麦克风"}
            </Text>
          </Pressable>
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
                ? t("settings.debug.resetFreeAccessBusy")
                : t("settings.debug.resetFreeAccessAction")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>声纹</Text>
          <View style={styles.languageCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>原生模块</Text>
              <Text style={styles.metricValue}>
                {voiceprintEnabled ? "可用" : "不可用"}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>本地样本</Text>
              <Text style={styles.metricValue}>
                {voiceprintEnrollmentReady ? "已就绪" : "未就绪"}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>最近相似度</Text>
              <Text style={styles.metricValue}>
                {formatSimilarity(lastVoiceprintSimilarity)}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>阈值区间</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintThresholdLow != null &&
                lastVoiceprintThresholdHigh != null
                  ? `${lastVoiceprintThresholdLow.toFixed(2)} -> ${lastVoiceprintThresholdHigh.toFixed(2)}`
                  : "--"}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>距本人阈值</Text>
              <Text style={styles.metricValue}>
                {formatThresholdDistance(
                  lastVoiceprintSimilarity,
                  lastVoiceprintThresholdHigh,
                )}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>距非本人阈值</Text>
              <Text style={styles.metricValue}>
                {formatThresholdDistance(
                  lastVoiceprintSimilarity,
                  lastVoiceprintThresholdLow,
                )}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>最近判定</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintDecision ?? "--"}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>置信度 / 原因</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintConfidence && lastVoiceprintReason
                  ? `${lastVoiceprintConfidence} · ${lastVoiceprintReason}`
                  : "--"}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>模型分桶</Text>
              <Text style={styles.metricValue}>
                {lastVoiceprintInputDurationMs != null
                  ? `${Math.round(lastVoiceprintInputDurationMs / 1000)}s / ${lastVoiceprintMelFrameCount ?? "--"}f`
                  : "--"}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>说话人来源</Text>
              <Text style={styles.metricValue}>
                {lastSpeakerDecisionSource ?? "--"}
              </Text>
            </View>
          </View>
        </View>

        {!hasDebugData ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>等待连接与转写链路数据</Text>
            <Text style={styles.emptyBody}>
              进入实时对话页后会预建主转写连接。开始对话后，这里会显示转写、大模型和救场链路状态。
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
                        step.status === "done" && styles.labelDone,
                        step.status === "error" && styles.labelError,
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
                        step.status === "error" && styles.detailError,
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

export function DebugOverlay(props: DebugOverlayProps) {
  if (!__DEV__) return null;
  return <DebugOverlayContent {...props} />;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 18,
    maxHeight: 420,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collapsedPill: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dragHandleWrap: {
    alignItems: "center",
    paddingBottom: 8,
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  collapsedTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
  },
  collapsedLabel: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },
  collapsedAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#60A5FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
  },
  headerAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#60A5FA",
  },
  inlineHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.58)",
  },
  emptyState: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: "rgba(255,255,255,0.62)",
  },
  scroll: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.62)",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepDuration: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
  },
  labelDone: {
    color: "#4ADE80",
  },
  labelError: {
    color: "#F87171",
  },
  detail: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 2,
  },
  detailError: {
    color: "#FCA5A5",
  },
  traceCard: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  traceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  traceHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  traceTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
  },
  traceKind: {
    fontSize: 11,
    fontWeight: "700",
    color: "#93C5FD",
    textTransform: "uppercase",
  },
  tracePreview: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.72)",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },
  metricValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
  },
  traceDetail: {
    marginTop: 8,
    fontSize: 11,
    color: "#86EFAC",
  },
  traceDetailError: {
    color: "#FCA5A5",
  },
  languageCard: {
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  helperText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255,255,255,0.55)",
  },
  controlLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  optionChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  optionChipSelected: {
    backgroundColor: "rgba(96,165,250,0.2)",
    borderColor: "rgba(96,165,250,0.48)",
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
  },
  optionChipTextSelected: {
    color: "#DBEAFE",
  },
  toolButton: {
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.18)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.42)",
    paddingHorizontal: 12,
  },
  toolButtonStacked: {
    marginBottom: 10,
  },
  toolButtonDisabled: {
    opacity: 0.6,
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#BFDBFE",
  },
});

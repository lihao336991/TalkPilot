import {
  historyService,
  type HistoryReview,
  type HistoryTurn,
  type SessionDetail,
  type SessionRecap,
} from "@/features/history/services/historyService";
import { getLanguageDisplayName } from "@/shared/locale/deviceLanguage";
import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatDuration(s: number | null, t: (key: string, p?: Record<string, string | number>) => string): string {
  if (!s || s <= 0) return t("history.duration.lessThanOneMinute");
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return t("history.duration.seconds", { count: sec });
  if (sec === 0) return t("history.duration.minutesOnly", { count: m });
  return t("history.duration.minutesSeconds", { minutes: m, seconds: sec });
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

const SCORE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: "rgba(34,197,94,0.12)", text: "#16A34A", label: "reviewBadge.green" },
  yellow: { bg: "rgba(234,179,8,0.12)", text: "#CA8A04", label: "reviewBadge.yellow" },
  red: { bg: "rgba(239,68,68,0.12)", text: "#DC2626", label: "reviewBadge.red" },
};

function findReviewForTurn(
  turn: HistoryTurn,
  reviews: HistoryReview[],
): HistoryReview | undefined {
  if (turn.speaker !== "self") return undefined;
  const normalizedTurnText = turn.text.trim().toLowerCase();
  return reviews.find(
    (r) => r.user_utterance.trim().toLowerCase() === normalizedTurnText,
  );
}

function TurnBubble({
  turn,
  review,
  t,
}: {
  turn: HistoryTurn;
  review: HistoryReview | undefined;
  t: (key: string) => string;
}) {
  const isSelf = turn.speaker === "self";
  const [expanded, setExpanded] = useState(false);
  const scoreStyle = review ? SCORE_COLORS[review.overall_score] : null;

  return (
    <View style={[styles.bubbleRow, isSelf && styles.bubbleRowSelf]}>
      <View style={styles.bubbleTimeWrap}>
        <Text style={styles.bubbleTime}>{formatTime(turn.created_at)}</Text>
      </View>
      <View style={{ flex: 1, alignItems: isSelf ? "flex-end" : "flex-start" }}>
        <Pressable
          onPress={review ? () => setExpanded((p) => !p) : undefined}
          style={[
            styles.bubble,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
          ]}
        >
          <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>
            {turn.text}
          </Text>
        </Pressable>
        {scoreStyle && (
          <View style={[styles.scoreBadge, { backgroundColor: scoreStyle.bg }]}>
            <View style={[styles.scoreDot, { backgroundColor: scoreStyle.text }]} />
            <Text style={[styles.scoreLabel, { color: scoreStyle.text }]}>
              {t(`history.detail.${scoreStyle.label}`)}
            </Text>
            {review && (review.issues?.length > 0 || review.better_expression) && (
              <Feather
                name={expanded ? "chevron-up" : "chevron-down"}
                size={12}
                color={scoreStyle.text}
              />
            )}
          </View>
        )}
        {expanded && review && (
          <View style={styles.reviewExpand}>
            {review.issues?.map((issue, idx) => (
              <View key={idx} style={styles.issueRow}>
                <Text style={styles.issueType}>{issue.type}</Text>
                <Text style={styles.issueOriginal}>{issue.original}</Text>
                <Feather name="arrow-right" size={11} color={palette.textTertiary} />
                <Text style={styles.issueCorrected}>{issue.corrected}</Text>
                {issue.explanation ? (
                  <Text style={styles.issueExplanation}>{issue.explanation}</Text>
                ) : null}
              </View>
            ))}
            {review.better_expression && (
              <View style={styles.betterWrap}>
                <Feather name="zap" size={12} color={palette.textAccent} />
                <Text style={styles.betterText}>{review.better_expression}</Text>
              </View>
            )}
            {review.praise && (
              <Text style={styles.praiseText}>{review.praise}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function RecapSection({
  recap,
  isGenerating,
  onRetry,
  t,
}: {
  recap: SessionRecap | null;
  isGenerating: boolean;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  if (isGenerating) {
    return (
      <View style={styles.recapCard}>
        <ActivityIndicator size="small" color={palette.textAccent} />
        <Text style={styles.recapGenerating}>{t("history.detail.recapGenerating")}</Text>
      </View>
    );
  }

  if (!recap) {
    return (
      <View style={styles.recapCard}>
        <Text style={styles.recapEmpty}>{t("history.detail.recapEmpty")}</Text>
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Feather name="refresh-cw" size={14} color={palette.textOnAccent} />
          <Text style={styles.retryBtnText}>{t("history.detail.recapRetry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.recapContainer}>
      {recap.highlights.length > 0 && (
        <View style={styles.recapCard}>
          <View style={styles.recapSectionHeader}>
            <Feather name="star" size={14} color={palette.textAccent} />
            <Text style={styles.recapSectionTitle}>{t("history.detail.highlights")}</Text>
          </View>
          {recap.highlights.map((h, i) => (
            <View key={i} style={styles.highlightItem}>
              <Text style={styles.highlightText}>{h.text}</Text>
              <Text style={styles.highlightExplanation}>{h.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {recap.improvements.length > 0 && (
        <View style={styles.recapCard}>
          <View style={styles.recapSectionHeader}>
            <Feather name="edit-3" size={14} color="#CA8A04" />
            <Text style={styles.recapSectionTitle}>{t("history.detail.improvements")}</Text>
          </View>
          {recap.improvements.map((imp, i) => (
            <View key={i} style={styles.improvementItem}>
              <View style={styles.improvementTypeWrap}>
                <Text style={styles.improvementType}>{imp.type}</Text>
              </View>
              <Text style={styles.improvementOriginal}>{imp.original}</Text>
              <View style={styles.improvementArrow}>
                <Feather name="arrow-down" size={12} color={palette.textTertiary} />
              </View>
              <Text style={styles.improvementCorrected}>{imp.corrected}</Text>
              {imp.explanation ? (
                <Text style={styles.improvementExplanation}>{imp.explanation}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {recap.overallComment ? (
        <View style={styles.recapCard}>
          <View style={styles.recapSectionHeader}>
            <Feather name="message-circle" size={14} color={palette.textAccent} />
            <Text style={styles.recapSectionTitle}>{t("history.detail.overallComment")}</Text>
          </View>
          <Text style={styles.overallText}>{recap.overallComment}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecapGenerating, setIsRecapGenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    const result = await historyService.loadSessionDetail(id);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setDetail(result.data);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleGenerateRecap = useCallback(async () => {
    if (!id) return;
    setIsRecapGenerating(true);
    const result = await historyService.generateRecap(id);
    if (result.recap && detail) {
      setDetail({
        ...detail,
        session: {
          ...detail.session,
          title: result.title ?? detail.session.title,
          recap: result.recap,
        },
      });
    }
    setIsRecapGenerating(false);
  }, [id, detail]);

  const session = detail?.session;
  const languageLabelLocale = i18n.language === "zh-CN" ? "zh-CN" : "en";
  const nativeLanguageName = getLanguageDisplayName(
    session?.native_language ?? undefined,
    languageLabelLocale,
  );
  const learningLanguageName = getLanguageDisplayName(
    session?.learning_language ?? undefined,
    languageLabelLocale,
  );
  const displayTitle = session?.title || session?.scene_description?.trim() || (session?.scene_preset
    ? session.scene_preset
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ")
    : t("history.scene.freeConversation"));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={22} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          {isLoading ? (
            <ActivityIndicator size="small" color={palette.textAccent} />
          ) : (
            <>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {displayTitle}
              </Text>
              {session && (
                <>
                  <Text style={styles.headerMeta}>
                    {formatDuration(session.duration_seconds, t)} · {formatDate(session.started_at, i18n.language)}
                  </Text>
                  <Text style={styles.headerLanguageMeta}>
                    {t("history.detail.nativeLanguage")}: {nativeLanguageName} ·{" "}
                    {t("history.detail.learningLanguage")}: {learningLanguageName}
                  </Text>
                </>
              )}
            </>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={palette.textAccent} />
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centerState}>
          <Feather name="alert-circle" size={28} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>{t("common.actions.tryAgain")}</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !error && detail && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Feather name="message-square" size={14} color={palette.textAccent} />
            <Text style={styles.sectionTitle}>{t("history.detail.conversation")}</Text>
          </View>

          {detail.turns.length === 0 ? (
            <View style={styles.emptyTurns}>
              <Text style={styles.emptyTurnsText}>{t("history.detail.noTurns")}</Text>
            </View>
          ) : (
            detail.turns.map((turn) => (
              <TurnBubble
                key={turn.id}
                turn={turn}
                review={findReviewForTurn(turn, detail.reviews)}
                t={t}
              />
            ))
          )}

          <View style={[styles.sectionHeader, { marginTop: spacing.xxl }]}>
            <Feather name="bar-chart-2" size={14} color={palette.textAccent} />
            <Text style={styles.sectionTitle}>{t("history.detail.recap")}</Text>
          </View>

          <RecapSection
            recap={detail.session.recap}
            isGenerating={isRecapGenerating}
            onRetry={handleGenerateRecap}
            t={t}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.accentBorder,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: palette.bgGhostButton,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...typography.bodyLg,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  headerMeta: {
    ...typography.labelMd,
    color: palette.textSecondary,
  },
  headerLanguageMeta: {
    ...typography.caption,
    color: palette.textTertiary,
  },
  headerSpacer: {
    width: 36,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xxl,
  },
  errorText: {
    ...typography.bodySm,
    color: palette.textSecondary,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.labelLg,
    color: palette.textAccent,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptyTurns: {
    borderRadius: radii.lg,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    padding: spacing.xxl,
    alignItems: "center",
  },
  emptyTurnsText: {
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bubbleRowSelf: {
    flexDirection: "row-reverse",
  },
  bubbleTimeWrap: {
    paddingTop: spacing.sm,
    width: 56,
    alignItems: "center",
  },
  bubbleTime: {
    ...typography.caption,
    color: palette.textTertiary,
    fontSize: 10,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.cardSm,
  },
  bubbleSelf: {
    backgroundColor: palette.accent,
    borderBottomRightRadius: radii.xs,
  },
  bubbleOther: {
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    borderBottomLeftRadius: radii.xs,
  },
  bubbleText: {
    ...typography.bodyMd,
    color: palette.textPrimary,
  },
  bubbleTextSelf: {
    color: palette.textOnAccent,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoreLabel: {
    ...typography.labelSm,
    fontWeight: "700",
  },
  reviewExpand: {
    marginTop: spacing.sm,
    backgroundColor: palette.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: spacing.sm,
    maxWidth: "85%",
  },
  issueRow: {
    gap: 2,
  },
  issueType: {
    ...typography.labelSm,
    color: palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  issueOriginal: {
    ...typography.bodySm,
    color: palette.danger,
    textDecorationLine: "line-through",
  },
  issueCorrected: {
    ...typography.bodySm,
    color: "#16A34A",
    fontWeight: "600",
  },
  issueExplanation: {
    ...typography.bodySm,
    color: palette.textSecondary,
    marginTop: 2,
  },
  betterWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: palette.accentBorder,
  },
  betterText: {
    ...typography.bodySm,
    color: palette.textAccent,
    fontWeight: "600",
    flex: 1,
  },
  praiseText: {
    ...typography.bodySm,
    color: palette.textSecondary,
    fontStyle: "italic",
  },
  recapContainer: {
    gap: spacing.md,
  },
  recapCard: {
    borderRadius: radii.lg,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.cardSm,
  },
  recapGenerating: {
    ...typography.bodySm,
    color: palette.textSecondary,
    textAlign: "center",
  },
  recapEmpty: {
    ...typography.bodySm,
    color: palette.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  retryBtnText: {
    ...typography.labelLg,
    color: palette.textOnAccent,
  },
  recapSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recapSectionTitle: {
    ...typography.labelLg,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  highlightItem: {
    gap: 2,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: palette.accent,
  },
  highlightText: {
    ...typography.bodyMd,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  highlightExplanation: {
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  improvementItem: {
    gap: 3,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: "#CA8A04",
  },
  improvementTypeWrap: {
    alignSelf: "flex-start",
  },
  improvementType: {
    ...typography.labelSm,
    color: palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  improvementOriginal: {
    ...typography.bodySm,
    color: palette.danger,
    textDecorationLine: "line-through",
  },
  improvementArrow: {
    paddingVertical: 1,
  },
  improvementCorrected: {
    ...typography.bodySm,
    color: "#16A34A",
    fontWeight: "600",
  },
  improvementExplanation: {
    ...typography.bodySm,
    color: palette.textSecondary,
    marginTop: 1,
  },
  overallText: {
    ...typography.bodyMd,
    color: palette.textPrimary,
    lineHeight: 22,
  },
});

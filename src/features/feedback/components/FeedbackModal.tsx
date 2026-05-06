import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  useFeedbackStore,
  type FeedbackContext,
} from "@/features/feedback/feedbackStore";
import type { Turn } from "@/features/live/store/conversationStore";
import { analytics } from "@/shared/analytics/analytics";
import { useAuthStore } from "@/shared/store/authStore";
import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";

type FeedbackCategory = "general" | "transcription" | "ai_reply" | "bug" | "other";

const CATEGORIES: FeedbackCategory[] = [
  "general",
  "transcription",
  "ai_reply",
  "bug",
  "other",
];

function truncateText(value: string | null | undefined, maxLen = 700) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}...` : trimmed;
}

function mapTurnForFeedback(turn: Turn) {
  return {
    id: turn.id,
    turn_id: turn.turnId,
    speaker: turn.speaker,
    text: truncateText(turn.text),
    translation: truncateText(turn.translation),
    is_final: turn.isFinal,
    is_assist: Boolean(turn.isAssist),
    review_score: turn.reviewScore ?? null,
    detected_language: turn.detectedLanguage ?? null,
    timestamp: turn.timestamp,
  };
}

function buildPayload(context: FeedbackContext, props: Record<string, unknown>) {
  return {
    surface: context.surface,
    session_id: context.sessionId ?? null,
    session_status: context.sessionStatus ?? null,
    session_started_at: context.sessionStartedAt
      ? new Date(context.sessionStartedAt).toISOString()
      : null,
    session_age_seconds: context.sessionStartedAt
      ? Math.max(0, Math.round((Date.now() - context.sessionStartedAt) / 1000))
      : null,
    session_duration_seconds: context.sessionDurationSeconds ?? null,
    scene_preset: context.scenePreset ?? null,
    scene_description: truncateText(context.sceneDescription, 500),
    copilot_enabled: context.copilotEnabled ?? null,
    main_ws_status: context.mainWsStatus ?? null,
    assist_ws_status: context.assistWsStatus ?? null,
    turn_count: context.turnCount ?? context.recentTurns?.length ?? 0,
    recent_turns: context.recentTurns?.slice(-12).map(mapTurnForFeedback) ?? [],
    current_stable_text: truncateText(context.currentStableText),
    current_interim_text: truncateText(context.currentInterimText),
    ai_suggestions:
      context.aiSuggestions?.slice(0, 3).map((suggestion) => ({
        style: suggestion.style,
        text: truncateText(suggestion.text),
      })) ?? [],
    ai_suggestion_trigger_turn_id: context.aiSuggestionTriggerTurnId ?? null,
    ...props,
  };
}

export function FeedbackModal() {
  const { t } = useTranslation();
  const context = useFeedbackStore((s) => s.context);
  const requestId = useFeedbackStore((s) => s.requestId);
  const closeFeedback = useFeedbackStore((s) => s.closeFeedback);
  const userId = useAuthStore((s) => s.userId);
  const authMode = useAuthStore((s) => s.authMode);
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!context) {
      return;
    }

    setRating(0);
    setCategory("general");
    setMessage("");
    setSubmitted(false);
    analytics.capture(
      "feedback_opened",
      buildPayload(context, {
        trigger: context.surface === "profile" ? "manual" : "auto",
      }),
    );
  }, [context, requestId]);

  const title = useMemo(() => {
    if (context?.surface === "profile") {
      return t("feedback.profileTitle");
    }
    return t("feedback.sessionTitle");
  }, [context?.surface, t]);

  const handleClose = () => {
    if (context) {
      analytics.capture(
        "feedback_cancelled",
        buildPayload(context, {
          had_rating: rating > 0,
          had_message: message.trim().length > 0,
        }),
      );
    }
    closeFeedback();
  };

  const handleSubmit = () => {
    if (!context || rating < 1) {
      return;
    }

    analytics.capture(
      "feedback_submitted",
      buildPayload(context, {
        rating,
        category,
        feedback_text: truncateText(message, 1800),
        user_id: userId,
        auth_mode: authMode,
        subscription_tier: subscriptionTier,
      }),
    );

    setSubmitted(true);
    setTimeout(() => {
      closeFeedback();
    }, 900);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={Boolean(context)}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.scrim} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{t("feedback.subtitle")}</Text>
            </View>
            <Pressable
              accessibilityLabel={t("feedback.closeAccessibilityLabel")}
              accessibilityRole="button"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <Feather name="x" size={19} color={palette.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                accessibilityLabel={t("feedback.ratingAccessibilityLabel", {
                  count: value,
                })}
                accessibilityRole="button"
                key={value}
                onPress={() => setRating(value)}
                style={[
                  styles.starButton,
                  value <= rating ? styles.starButtonActive : null,
                ]}
              >
                <Feather
                  name="star"
                  size={24}
                  color={
                    value <= rating ? palette.textOnAccent : palette.textTertiary
                  }
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryButton,
                    selected ? styles.categoryButtonActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selected ? styles.categoryTextActive : null,
                    ]}
                  >
                    {t(`feedback.categories.${item}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            multiline
            onChangeText={setMessage}
            placeholder={t("feedback.placeholder")}
            placeholderTextColor={palette.textTertiary}
            style={styles.input}
            textAlignVertical="top"
            value={message}
          />

          <Pressable
            accessibilityRole="button"
            disabled={rating < 1 || submitted}
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              rating < 1 || submitted ? styles.submitButtonDisabled : null,
            ]}
          >
            <Text style={styles.submitText}>
              {submitted ? t("feedback.submitted") : t("feedback.submit")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlayDark,
  },
  sheet: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    ...shadows.cardLg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: palette.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bgGhostButton,
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  starButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  starButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accentDark,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  categoryButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: "rgba(15,23,42,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  categoryButtonActive: {
    backgroundColor: palette.accentMutedMid,
    borderColor: palette.accentBorderStrong,
  },
  categoryText: {
    ...typography.labelMd,
    color: palette.textSecondary,
  },
  categoryTextActive: {
    color: palette.textAccent,
  },
  input: {
    minHeight: 112,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: palette.bgInput,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...typography.bodyMd,
    color: palette.textPrimary,
  },
  submitButton: {
    minHeight: 48,
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  submitButtonDisabled: {
    backgroundColor: palette.disabledBg,
  },
  submitText: {
    ...typography.labelLg,
    color: palette.textOnAccent,
  },
});

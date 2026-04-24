import ReviewDetailCard from "@/features/live/components/ReviewDetailCard";
import ReviewIndicator from "@/features/live/components/ReviewIndicator";
import type { ReviewResult } from "@/features/live/store/reviewStore";
import type {
  TranslationDirection,
  TranslationStatus,
} from "@/features/live/store/conversationStore";
import { translationService } from "@/features/live/services/TranslationService";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const GRADIENTS = {
  green: ["#E3F5E1", "#D4EDDA"] as const,
  yellow: ["#FFF3E0", "#FFE0B2"] as const,
  red: ["#FFEBEE", "#FFCDD2"] as const,
};

type TranscriptBubbleProps = {
  speaker: "self" | "other";
  text: string;
  isFinal: boolean;
  reviewScore?: "green" | "yellow" | "red";
  review?: ReviewResult;
  showReviewIndicator?: boolean;
  isAssist?: boolean;
  assistSourceText?: string;
  translation?: string;
  translationStatus?: TranslationStatus;
  translationDirection?: TranslationDirection;
};

export function TranscriptBubble({
  speaker,
  text,
  isFinal,
  reviewScore,
  review,
  showReviewIndicator = false,
  isAssist = false,
  assistSourceText,
  translation,
  translationStatus,
  translationDirection,
}: TranscriptBubbleProps) {
  const { t } = useTranslation();
  const isSelf = speaker === "self";
  const opacity = React.useRef(new Animated.Value(isFinal ? 1 : 0.6)).current;
  const [detailVisible, setDetailVisible] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const hasVisibleReviewIndicator =
    showReviewIndicator &&
    isSelf &&
    review !== undefined &&
    reviewScore !== undefined &&
    reviewScore !== "green";

  const hasTranslation =
    translationStatus === "loading" ||
    translationStatus === "done" ||
    translationStatus === "error";
  const canPlayTranslation =
    translationStatus === "done" &&
    translationDirection === "to_learning" &&
    isSelf &&
    !!translation;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: isFinal ? 1 : 0.6,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFinal, opacity]);

  const handlePlayTranslation = React.useCallback(async () => {
    if (!translation || !canPlayTranslation) return;
    try {
      setSpeaking(true);
      await translationService.speakLearning(translation);
    } finally {
      setSpeaking(false);
    }
  }, [translation, canPlayTranslation]);

  return (
    <View style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}>
      <Pressable
        onPress={() => {
          if (hasVisibleReviewIndicator) {
            setDetailVisible(true);
          }
        }}
        disabled={!hasVisibleReviewIndicator}
      >
        <Animated.View
          style={[
            styles.bubble,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
            isSelf && reviewScore && !isAssist && { backgroundColor: "transparent" },
            isAssist && styles.bubbleAssist,
            { opacity },
          ]}
        >
          {isSelf && reviewScore && !isAssist && (
            <LinearGradient
              colors={GRADIENTS[reviewScore]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: 18, borderBottomRightRadius: 4 },
              ]}
            />
          )}
          {isAssist && assistSourceText && (
            <View style={styles.assistSourceContainer}>
              <Text style={styles.assistSourceText}>{assistSourceText}</Text>
              <View style={styles.assistDivider} />
            </View>
          )}
          <Animated.Text
            style={[
              styles.text,
              isSelf ? styles.textSelf : styles.textOther,
              isAssist && styles.textAssist,
            ]}
          >
            {text}
          </Animated.Text>

          {hasTranslation && (
            <View style={styles.translationContainer}>
              <View style={styles.translationRow}>
                <View style={styles.translationTextWrap}>
                  {translationStatus === "loading" && (
                    <Text style={styles.translationLoading}>
                      {t("live.transcript.translating")}
                    </Text>
                  )}
                  {translationStatus === "done" && translation && (
                    <Text style={styles.translationText}>{translation}</Text>
                  )}
                  {translationStatus === "error" && (
                    <Text style={styles.translationError}>
                      {t("live.transcript.translationFailed")}
                    </Text>
                  )}
                </View>
                {canPlayTranslation && (
                  <Pressable
                    onPress={handlePlayTranslation}
                    style={styles.ttsButton}
                    accessibilityLabel={t("live.transcript.playLearningTranslation")}
                    hitSlop={8}
                  >
                    <Feather
                      name={speaking ? "volume-2" : "volume-1"}
                      size={16}
                      color="#174EA6"
                    />
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </Animated.View>
      </Pressable>
      {hasVisibleReviewIndicator && review && (
        <ReviewIndicator
          review={review}
          onPress={() => setDetailVisible(true)}
        />
      )}
      {hasVisibleReviewIndicator && review && (
        <Modal
          animationType="fade"
          transparent
          visible={detailVisible}
          onRequestClose={() => setDetailVisible(false)}
        >
          <ReviewDetailCard
            review={review}
            onClose={() => setDetailVisible(false)}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  rowSelf: {
    alignItems: "flex-end",
  },
  rowOther: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
  },
  bubbleSelf: {
    backgroundColor: "#F2F2F7",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.08)",
  },
  bubbleAssist: {
    backgroundColor: "#E8F0FE",
    borderWidth: 1,
    borderColor: "#D2E3FC",
  },
  assistSourceContainer: {
    marginBottom: 6,
  },
  assistSourceText: {
    fontSize: 14,
    color: "rgba(26,26,26,0.6)",
    fontStyle: "italic",
  },
  assistDivider: {
    height: 1,
    backgroundColor: "rgba(21,22,25,0.08)",
    marginTop: 6,
    width: "100%",
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textSelf: {
    color: "#1A1A1A",
  },
  textOther: {
    color: "#1A1A1A",
  },
  translationContainer: {
    marginTop: 6,
  },
  translationRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  translationTextWrap: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  translationText: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(26,26,26,0.5)",
  },
  textAssist: {
    color: "#174EA6",
    fontWeight: "500",
  },
  translationLoading: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(21,22,25,0.5)",
  },
  translationError: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(180,35,24,0.72)",
  },
  ttsButton: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: "rgba(21,22,25,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});

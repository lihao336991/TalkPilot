import ReviewDetailCard from "@/features/live/components/ReviewDetailCard";
import ReviewIndicator from "@/features/live/components/ReviewIndicator";
import type { ReviewResult } from "@/features/live/store/reviewStore";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
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
}: TranscriptBubbleProps) {
  const isSelf = speaker === "self";
  const opacity = React.useRef(new Animated.Value(isFinal ? 1 : 0.6)).current;
  const [detailVisible, setDetailVisible] = React.useState(false);
  const hasVisibleReviewIndicator =
    showReviewIndicator &&
    isSelf &&
    review !== undefined &&
    reviewScore !== undefined &&
    reviewScore !== "green";

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: isFinal ? 1 : 0.6,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFinal, opacity]);

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
            isSelf &&
              reviewScore &&
              !isAssist && { backgroundColor: "transparent" },
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
    backgroundColor: "#E8F0FE", // A soft blue background for assist messages
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
    backgroundColor: "rgba(26,26,26,0.08)",
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
  textAssist: {
    color: "#174EA6", // A slightly darker blue for the translated text to stand out
    fontWeight: "500",
  },
});

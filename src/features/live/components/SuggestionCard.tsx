import {
    palette,
    radii,
    shadows,
    spacing,
    typography,
} from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

type SuggestionStyle = "formal" | "casual" | "simple";

type Props = {
  suggestion: {
    style: SuggestionStyle;
    text: string;
  };
  onSend?: () => void;
  isSending?: boolean;
};

export default function SuggestionCard({
  suggestion,
  onSend,
  isSending = false,
}: Props) {
  const { t } = useTranslation();
  const wordCount = React.useMemo(
    () => suggestion.text.trim().split(/\s+/).filter(Boolean).length,
    [suggestion.text],
  );
  const isLongSuggestion = wordCount > 14 || suggestion.text.trim().length > 78;

  return (
    <LinearGradient
      colors={[
        "rgba(184,225,50,0.96)",
        "rgba(168,213,36,0.9)",
        "rgba(153,199,27,0.84)",
      ]}
      start={{ x: 0, y: 0.1 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.glassGlow} />
      <View style={styles.glassSheen} />
      <View style={styles.leadingIconWrap}>
        <Feather name="zap" size={15} color="rgba(255,255,255,0.95)" />
      </View>
      <View style={styles.content}>
        <Text style={[styles.text, isLongSuggestion && styles.textCompact]}>
          {suggestion.text}
        </Text>
      </View>
      <Pressable
        style={[styles.actionButton, isSending && styles.actionButtonDisabled]}
        onPress={onSend}
        disabled={isSending}
        accessibilityLabel={t("live.suggestionPanel.actionSendAndPlay")}
        hitSlop={8}
      >
        <Feather
          name="volume-2"
          size={18}
          color={isSending ? palette.textTertiary : palette.textAccent}
        />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 88,
    borderRadius: 30,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    ...shadows.cardLg,
  },
  glassGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: radii.circle,
    left: -42,
    top: -68,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  glassSheen: {
    position: "absolute",
    left: 32,
    right: 94,
    top: 12,
    height: 26,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  leadingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  content: {
    flex: 1,
    paddingRight: 6,
  },
  text: {
    ...typography.bodyLg,
    lineHeight: 26,
    fontWeight: "800",
    color: "rgba(255,255,255,0.98)",
  },
  textCompact: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: radii.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#7EAA00",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  actionButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.76)",
  },
});

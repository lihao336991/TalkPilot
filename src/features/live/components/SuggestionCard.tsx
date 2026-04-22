import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";

type SuggestionStyle = "formal" | "casual" | "simple";

type Props = {
  suggestion: {
    style: SuggestionStyle;
    text: string;
  };
  onPress?: () => void;
};

export default function SuggestionCard({ suggestion, onPress }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.bubble} onPress={onPress}>
        <Text style={styles.label}>{t(`live.suggestionStyle.${suggestion.style}`)}</Text>
        <Text style={styles.text}>{suggestion.text}</Text>
      </Pressable>
      <View style={styles.tailShadow} />
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: 292,
    paddingBottom: 10,
    paddingLeft: 10,
  },
  bubble: {
    borderRadius: radii.xl,
    borderBottomLeftRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: 6,
    ...shadows.card,
  },
  label: {
    ...typography.tabLabel,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: palette.textTertiary,
  },
  text: {
    ...typography.bodySm,
    lineHeight: 20,
    color: palette.textPrimary,
  },
  tailShadow: {
    position: "absolute",
    left: 12,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: radii.xs / 2,
    backgroundColor: palette.accentMuted,
    transform: [{ rotate: "45deg" }],
  },
  tail: {
    position: "absolute",
    left: 10,
    bottom: 6,
    width: 16,
    height: 16,
    borderBottomLeftRadius: radii.xs / 2,
    backgroundColor: palette.bgCardSolid,
    transform: [{ rotate: "45deg" }],
  },
});

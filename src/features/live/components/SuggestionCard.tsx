import {
  palette,
  radii,
  spacing,
  typography,
} from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  const styleLabel = t(`live.suggestionStyle.${suggestion.style}`);
  const wordCount = React.useMemo(
    () => suggestion.text.trim().split(/\s+/).filter(Boolean).length,
    [suggestion.text],
  );
  const isLongSuggestion = wordCount > 14 || suggestion.text.trim().length > 78;

  return (
    <LinearGradient
      colors={[
        "rgba(25,43,8,0.98)",
        "rgba(83,116,0,0.96)",
        "rgba(154,199,23,0.95)",
      ]}
      locations={[0, 0.58, 1]}
      start={{ x: 0.05, y: 0.02 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.depthGlow} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(255,255,255,0.26)",
          "rgba(255,255,255,0.08)",
          "rgba(255,255,255,0)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.sheen}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.72)", "rgba(194,234,69,0.88)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.accentRail}
      />
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{styleLabel}</Text>
        </View>
        <Text style={[styles.text, isLongSuggestion && styles.textCompact]}>
          {suggestion.text}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          pressed && !isSending && styles.actionButtonPressed,
          isSending && styles.actionButtonDisabled,
        ]}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSend?.();
        }}
        disabled={isSending}
        accessibilityLabel={t("live.suggestionPanel.actionSendAndPlay")}
        accessibilityRole="button"
        hitSlop={14}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={palette.textTertiary} />
        ) : (
          <View style={styles.actionIconInner}>
            <Feather name="send" size={19} color={palette.textOnAccent} />
          </View>
        )}
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 94,
    borderRadius: radii.xxl,
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#5F7E00",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  depthGlow: {
    position: "absolute",
    right: -48,
    bottom: -72,
    width: 184,
    height: 184,
    borderRadius: radii.circle,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  sheen: {
    position: "absolute",
    left: 18,
    right: 72,
    top: 0,
    height: 42,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 32,
  },
  accentRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    ...typography.caption,
    color: "rgba(255,255,255,0.76)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  text: {
    ...typography.bodyLg,
    lineHeight: 25,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  textCompact: {
    fontSize: 15,
    lineHeight: 21,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: radii.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    shadowColor: "#1B2B05",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  actionIconInner: {
    width: 38,
    height: 38,
    borderRadius: radii.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
    borderWidth: 1,
    borderColor: "rgba(134,174,0,0.18)",
  },
  actionButtonPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: "#F7FFE8",
  },
  actionButtonDisabled: {
    backgroundColor: "rgba(226,232,240,0.88)",
    borderColor: "rgba(148,163,184,0.16)",
    shadowOpacity: 0,
    elevation: 0,
  },
});

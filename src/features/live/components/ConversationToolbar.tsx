import { palette, spacing } from "@/shared/theme/tokens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioInputStore } from "../store/audioInputStore";
import {
  PressAndSlideAction,
  PressAndSlideButton,
} from "./PressAndSlideButton";

type ConversationToolbarProps = {
  copilotEnabled: boolean;
  onToggleCopilot: () => void;
  onEnd: () => void;
  onNativeAssistPressIn: () => void;
  onNativeAssistPressOut: (action: PressAndSlideAction) => void;
  assistPreviewText?: string;
};

export function ConversationToolbar({
  copilotEnabled,
  onToggleCopilot,
  onEnd,
  onNativeAssistPressIn,
  onNativeAssistPressOut,
  assistPreviewText,
}: ConversationToolbarProps) {
  const { t } = useTranslation();
  const assistAudioLevel = useAudioInputStore((s) => s.assistLevel);
  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.controlTouch}
          onPress={onToggleCopilot}
          accessibilityRole="switch"
          accessibilityState={{ checked: copilotEnabled }}
          accessibilityLabel={t("live.toolbar.copilotAccessibility", {
            state: copilotEnabled
              ? t("live.toolbar.copilotOn")
              : t("live.toolbar.copilotOff"),
          })}
        >
          <View
            style={[
              styles.controlButton,
              styles.copilotButton,
              copilotEnabled
                ? styles.copilotButtonActive
                : styles.copilotButtonInactive,
            ]}
          >
            <MaterialCommunityIcons
              name={copilotEnabled ? "creation" : "creation-outline"}
              size={18}
              color={copilotEnabled ? palette.accent : palette.textSecondary}
            />
            <Text
              style={[
                styles.copilotLabel,
                copilotEnabled
                  ? styles.copilotLabelActive
                  : styles.copilotLabelInactive,
              ]}
            >
              {t("live.toolbar.copilot")}
            </Text>
          </View>
        </Pressable>

        <View style={styles.centerSlot}>
          <PressAndSlideButton
            label="SOS"
            defaultColor={palette.textSecondary}
            activeColor={palette.textOnAccent}
            defaultBg="rgba(244,248,239,0.9)"
            activeBg={palette.accent}
            cancelBg="#FF5A58"
            sendBg={palette.accent}
            onPressIn={onNativeAssistPressIn}
            onPressOut={onNativeAssistPressOut}
            previewText={assistPreviewText}
            slideThresholdLeft={-72}
            slideThresholdRight={72}
            buttonStyle={[styles.controlButton, styles.assistButton]}
            labelStyle={styles.assistLabel}
            neutralHint={t("live.pressAndSlide.releaseTranslateOnly")}
            showHoldRipple
            rippleColor="rgba(194,234,69,0.34)"
            overlayTitle={t("live.toolbar.assistOverlayTitle")}
            overlaySubtitle={t("live.toolbar.assistOverlaySubtitle")}
            energyLevel={assistAudioLevel}
          />
        </View>

        <Pressable
          style={styles.controlTouch}
          onPress={onEnd}
          accessibilityLabel={t("live.toolbar.endConversation")}
        >
          <View style={[styles.controlButton, styles.endBtnInner]}>
            <MaterialCommunityIcons
              name="phone-hangup"
              size={20}
              color="#FFFFFF"
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: 28,
    borderRadius: 34,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(250,252,247,0.84)",
    borderWidth: 1,
    borderColor: "rgba(134,174,0,0.12)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlTouch: {
    width: 84,
    alignItems: "center",
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  copilotButton: {
    width: 64,
    borderRadius: 20,
    gap: 4,
  },
  copilotButtonActive: {
    borderColor: "rgba(134,174,0,0.22)",
    backgroundColor: "rgba(244,248,239,0.96)",
    shadowColor: palette.accent,
    shadowOpacity: 0.1,
  },
  copilotButtonInactive: {
    borderColor: "rgba(15,23,42,0.06)",
    backgroundColor: "rgba(255,255,255,0.76)",
  },
  copilotLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  copilotLabelActive: {
    color: palette.accent,
  },
  copilotLabelInactive: {
    color: palette.textSecondary,
  },
  endBtnInner: {
    backgroundColor: palette.danger,
    borderColor: "rgba(220,38,38,0.85)",
    shadowColor: palette.danger,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  assistButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: "rgba(134,174,0,0.14)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  assistLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
});

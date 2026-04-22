import { palette, spacing } from "@/shared/theme/tokens";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import {
  PressAndSlideAction,
  PressAndSlideButton,
} from "./PressAndSlideButton";

type ConversationToolbarProps = {
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onNativeAssistPressIn: () => void;
  onNativeAssistPressOut: (action: PressAndSlideAction) => void;
  isPaused: boolean;
  assistPreviewText?: string;
};

export function ConversationToolbar({
  onPause,
  onResume,
  onEnd,
  onNativeAssistPressIn,
  onNativeAssistPressOut,
  isPaused,
  assistPreviewText,
}: ConversationToolbarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.controlTouch}
          onPress={isPaused ? onResume : onPause}
          accessibilityLabel={
            isPaused ? t("live.toolbar.resume") : t("live.toolbar.pause")
          }
        >
          <View style={[styles.controlButton, styles.pauseBtnInner]}>
            <Feather
              name={isPaused ? "play" : "pause"}
              size={18}
              color={palette.textPrimary}
            />
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
    width: 76,
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
  pauseBtnInner: {
    backgroundColor: "rgba(255,255,255,0.76)",
    borderColor: "rgba(15,23,42,0.04)",
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

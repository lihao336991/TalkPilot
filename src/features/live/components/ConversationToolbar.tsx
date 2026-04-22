import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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
  isNativeAssistActive: boolean;
  assistPreviewText?: string;
  duration: number;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ConversationToolbar({
  onPause,
  onResume,
  onEnd,
  onNativeAssistPressIn,
  onNativeAssistPressOut,
  isPaused,
  isNativeAssistActive,
  assistPreviewText,
  duration,
}: ConversationToolbarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {/* Timer row */}
      <View style={styles.timerRow}>
        <View style={styles.timerLiveDot} />
        <Text style={styles.timer}>{formatDuration(duration)}</Text>
        <Text style={styles.timerHint}>
          {isPaused
            ? t("live.toolbar.paused")
            : isNativeAssistActive
              ? t("live.toolbar.listening")
              : t("live.toolbar.live")}
        </Text>
      </View>

      {/* Controls row */}
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.sideBtn}
          onPress={isPaused ? onResume : onPause}
          accessibilityLabel={isPaused ? t("live.toolbar.resume") : t("live.toolbar.pause")}
        >
          <View style={styles.sideBtnInner}>
            <Feather name={isPaused ? "play" : "pause"} size={20} color={palette.textPrimary} />
          </View>
          <Text style={styles.sideBtnLabel}>
            {isPaused ? t("live.toolbar.resume") : t("live.toolbar.pause")}
          </Text>
        </Pressable>

        <View style={styles.centerSlot}>
          <Text style={styles.assistHint}>
            {isNativeAssistActive
              ? t("live.toolbar.releaseToSend")
              : t("live.toolbar.holdToSpeak")}
          </Text>
          <PressAndSlideButton
            label="SOS"
            defaultColor={palette.textOnAccent}
            activeColor={palette.textOnAccent}
            defaultBg={palette.accent}
            activeBg={palette.accent}
            cancelBg="#FF5A58"
            sendBg={palette.accent}
            onPressIn={onNativeAssistPressIn}
            onPressOut={onNativeAssistPressOut}
            previewText={assistPreviewText}
            slideThresholdLeft={-72}
            slideThresholdRight={72}
          />
        </View>

        <Pressable
          style={styles.sideBtn}
          onPress={onEnd}
          accessibilityLabel={t("live.toolbar.endConversation")}
        >
          <View style={[styles.sideBtnInner, styles.endBtnInner]}>
            <MaterialCommunityIcons
              name="phone-hangup"
              size={20}
              color={palette.textOnAccent}
            />
          </View>
          <Text style={[styles.sideBtnLabel, styles.endBtnLabel]}>{t("live.toolbar.end")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: 28,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: 14,
    ...shadows.card,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  timerLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.accentDark,
  },
  timer: {
    ...typography.timer,
    color: palette.textPrimary,
  },
  timerHint: {
    ...typography.caption,
    color: palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sideBtn: {
    alignItems: "center",
    gap: spacing.xs + 2,
    width: 56,
  },
  sideBtnInner: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: palette.accentMuted,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  endBtnInner: {
    backgroundColor: palette.danger,
    borderColor: palette.danger,
  },
  sideBtnLabel: {
    ...typography.tabLabel,
    color: palette.textTertiary,
  },
  endBtnLabel: {
    color: palette.danger,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  assistHint: {
    ...typography.caption,
    color: palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});

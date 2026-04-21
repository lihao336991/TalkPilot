import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  return (
    <View style={styles.container}>
      {/* Timer row */}
      <View style={styles.timerRow}>
        <View style={styles.timerLiveDot} />
        <Text style={styles.timer}>{formatDuration(duration)}</Text>
        <Text style={styles.timerHint}>
          {isPaused ? "Paused" : isNativeAssistActive ? "Listening…" : "Live"}
        </Text>
      </View>

      {/* Controls row */}
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.sideBtn}
          onPress={isPaused ? onResume : onPause}
          accessibilityLabel={isPaused ? "Resume" : "Pause"}
        >
          <View style={styles.sideBtnInner}>
            <Feather name={isPaused ? "play" : "pause"} size={20} color={palette.textPrimary} />
          </View>
          <Text style={styles.sideBtnLabel}>{isPaused ? "Resume" : "Pause"}</Text>
        </Pressable>

        <View style={styles.centerSlot}>
          <Text style={styles.assistHint}>
            {isNativeAssistActive ? "Release to send" : "Hold to speak"}
          </Text>
          <PressAndSlideButton
            icon="message-circle"
            defaultColor={palette.accentDeep}
            activeColor={palette.accentDeep}
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

        <Pressable style={styles.sideBtn} onPress={onEnd} accessibilityLabel="End conversation">
          <View style={[styles.sideBtnInner, styles.endBtnInner]}>
            <Feather name="square" size={18} color={palette.danger} />
          </View>
          <Text style={[styles.sideBtnLabel, styles.endBtnLabel]}>End</Text>
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
    backgroundColor: palette.dangerLight,
    borderColor: palette.dangerBorder,
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

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
      <View style={styles.sideSlot}>
        <Pressable
          style={styles.button}
          onPress={isPaused ? onResume : onPause}
          accessibilityLabel={isPaused ? "Resume" : "Pause"}
        >
          <Feather
            name={isPaused ? "play-circle" : "pause-circle"}
            size={28}
            color="#1A1A1A"
          />
        </Pressable>
      </View>

      <View style={styles.centerColumn}>
        <View style={styles.timerWrap}>
          <Text style={styles.timer}>{formatDuration(duration)}</Text>
          <Text style={styles.timerHint}>
            {isNativeAssistActive
              ? "Listening..."
              : "Hold to speak, release to send"}
          </Text>
        </View>
        <PressAndSlideButton
          icon="message-circle"
          defaultColor="#1A1A1A"
          activeColor="#FFFFFF"
          defaultBg="#FFFFFF"
          activeBg="#92EA63"
          cancelBg="#FF5A58"
          sendBg="#92EA63"
          onPressIn={onNativeAssistPressIn}
          onPressOut={onNativeAssistPressOut}
          previewText={assistPreviewText}
          slideThresholdLeft={-72}
          slideThresholdRight={72}
        />
      </View>

      <View style={styles.sideSlot}>
        <Pressable
          style={styles.button}
          onPress={onEnd}
          accessibilityLabel="End conversation"
        >
          <Feather name="stop-circle" size={28} color="#FF3B30" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 34,
    marginHorizontal: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.06)",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  sideSlot: {
    width: 48,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  centerColumn: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 12,
  },
  timerWrap: {
    alignItems: "center",
    gap: 2,
  },
  button: {
    padding: 8,
  },
  timer: {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "#1A1A1A",
  },
  timerHint: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
});

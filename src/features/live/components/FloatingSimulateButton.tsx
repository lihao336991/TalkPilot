import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

const HOLD_DELAY_MS = 180;
const BUTTON_SIZE = 72;

type FloatingSimulateButtonProps = {
  onRecordStart: () => void;
  onRecordEnd: () => void;
  isRecording: boolean;
  initialRight?: number;
  initialBottom?: number;
};

export function FloatingSimulateButton({
  onRecordStart,
  onRecordEnd,
  isRecording,
  initialRight = 20,
  initialBottom = 180,
}: FloatingSimulateButtonProps) {
  const [isPressActive, setIsPressActive] = useState(false);
  const didStartRecordingRef = useRef(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isPressActive || isRecording ? 1.08 : 1,
      useNativeDriver: false,
      friction: 6,
      tension: 140,
    }).start();
  }, [isPressActive, isRecording, scale]);

  const handleLongPress = () => {
    if (didStartRecordingRef.current) {
      return;
    }

    didStartRecordingRef.current = true;
    setIsPressActive(true);
    onRecordStart();
  };

  const handlePressOut = () => {
    const didStartRecording = didStartRecordingRef.current;
    didStartRecordingRef.current = false;
    setIsPressActive(false);

    if (!didStartRecording) {
      return;
    }

    onRecordEnd();
  };

  const isActive = isPressActive || isRecording;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.buttonWrap,
          {
            right: initialRight,
            bottom: initialBottom,
            transform: [{ scale }],
          },
        ]}
      >
        <Pressable
          delayLongPress={HOLD_DELAY_MS}
          onLongPress={handleLongPress}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.button,
            isActive && styles.buttonRecording,
            pressed && !isActive && styles.buttonPressed,
          ]}
        >
          <Feather
            name="users"
            size={24}
            color={isActive ? "#FFFFFF" : "#1A1A1A"}
          />
          <Text style={[styles.label, isActive && styles.labelRecording]}>
            {isActive ? "松手结束" : "按住模拟对方"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    position: "absolute",
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.1)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  buttonPressed: {
    backgroundColor: "rgba(21,22,25,0.08)",
  },
  buttonRecording: {
    backgroundColor: "#151619",
  },
  label: {
    width: 56,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    textAlign: "center",
    color: "#1A1A1A",
  },
  labelRecording: {
    color: "#FFFFFF",
  },
});

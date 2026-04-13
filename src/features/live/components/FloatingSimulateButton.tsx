import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

const HOLD_DELAY_MS = 180;
const DRAG_THRESHOLD = 8;
const BUTTON_SIZE = 64;
const ARC_SIZE = 180;
const ARC_INNER_RADIUS = BUTTON_SIZE / 2 + 6;
const EDGE_MARGIN = 12;

type FloatingSimulateButtonProps = {
  onRecordStart: () => void;
  onRecordEnd: (isCancelled: boolean) => void;
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
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPressActive, setIsPressActive] = useState(false);
  const [gestureAction, setGestureAction] = useState<"neutral" | "send" | "cancel">(
    "neutral",
  );

  const position = useRef(
    new Animated.ValueXY({ x: 0, y: 0 }),
  ).current;
  const baseOffset = useRef({ x: 0, y: 0 });
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didStartRecordingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const buttonFrameRef = useRef({
    left: 0,
    top: 0,
    right: BUTTON_SIZE,
    bottom: BUTTON_SIZE,
  });
  const gestureActionRef = useRef<"neutral" | "send" | "cancel">("neutral");
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isPressActive || isRecording ? 1.12 : 1,
      useNativeDriver: false,
      friction: 6,
      tension: 140,
    }).start();
  }, [isPressActive, isRecording, scale]);

  useEffect(() => {
    if (!isRecording) {
      setGestureAction("neutral");
      gestureActionRef.current = "neutral";
    }
  }, [isRecording]);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const updateGestureAction = (nextAction: "neutral" | "send" | "cancel") => {
    if (gestureActionRef.current === nextAction) {
      return;
    }
    gestureActionRef.current = nextAction;
    setGestureAction(nextAction);
  };

  const clampPosition = (x: number, y: number) => {
    const maxX = Math.max(EDGE_MARGIN, bounds.width - BUTTON_SIZE - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, bounds.height - BUTTON_SIZE - EDGE_MARGIN);
    return {
      x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
      y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
    };
  };

  const snapToEdge = (x: number, y: number, animate: boolean) => {
    const maxX = Math.max(EDGE_MARGIN, bounds.width - BUTTON_SIZE - EDGE_MARGIN);
    const targetX = x + BUTTON_SIZE / 2 >= bounds.width / 2 ? maxX : EDGE_MARGIN;
    const next = clampPosition(targetX, y);
    baseOffset.current = next;

    if (animate) {
      Animated.spring(position, {
        toValue: next,
        useNativeDriver: false,
        friction: 8,
        tension: 120,
      }).start();
    } else {
      position.setValue(next);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: (event) => {
          didStartRecordingRef.current = false;
          setIsDragging(false);
          setGestureAction("neutral");
          gestureActionRef.current = "neutral";
          setIsPressActive(false);
          buttonFrameRef.current = {
            left: event.nativeEvent.pageX - event.nativeEvent.locationX,
            top: event.nativeEvent.pageY - event.nativeEvent.locationY,
            right:
              event.nativeEvent.pageX - event.nativeEvent.locationX + BUTTON_SIZE,
            bottom:
              event.nativeEvent.pageY - event.nativeEvent.locationY + BUTTON_SIZE,
          };
          dragOffsetRef.current = {
            x: baseOffset.current.x,
            y: baseOffset.current.y,
          };
          pressTimerRef.current = setTimeout(() => {
            didStartRecordingRef.current = true;
            setIsPressActive(true);
            onRecordStart();
          }, HOLD_DELAY_MS);
        },
        onPanResponderMove: (_, gestureState) => {
          const movedEnough =
            Math.abs(gestureState.dx) > DRAG_THRESHOLD ||
            Math.abs(gestureState.dy) > DRAG_THRESHOLD;

          if (didStartRecordingRef.current) {
            const frame = buttonFrameRef.current;
            const centerX = (frame.left + frame.right) / 2;
            const centerY = (frame.top + frame.bottom) / 2;
            const dx = gestureState.moveX - centerX;
            const dy = gestureState.moveY - centerY;
            const distance = Math.hypot(dx, dy);

            if (distance <= ARC_INNER_RADIUS) {
              updateGestureAction("neutral");
            } else if (dy <= 0) {
              updateGestureAction("send");
            } else {
              updateGestureAction("cancel");
            }
            return;
          }

          if (movedEnough) {
            clearPressTimer();
            setIsDragging(true);
            const next = clampPosition(
              dragOffsetRef.current.x + gestureState.dx,
              dragOffsetRef.current.y + gestureState.dy,
            );
            position.setValue(next);
          }
        },
        onPanResponderRelease: () => {
          clearPressTimer();
          if (didStartRecordingRef.current) {
            onRecordEnd(gestureActionRef.current === "cancel");
          } else {
            const current =
              // @ts-expect-error __getValue exists on RN Animated.ValueXY
              typeof position.__getValue === "function"
                ? // @ts-expect-error __getValue exists on RN Animated.ValueXY
                  position.__getValue()
                : baseOffset.current;
            snapToEdge(current.x, current.y, true);
          }
          didStartRecordingRef.current = false;
          setIsDragging(false);
          setIsPressActive(false);
          updateGestureAction("neutral");
        },
        onPanResponderTerminate: () => {
          clearPressTimer();
          if (didStartRecordingRef.current) {
            onRecordEnd(true);
          } else {
            snapToEdge(baseOffset.current.x, baseOffset.current.y, true);
          }
          didStartRecordingRef.current = false;
          setIsDragging(false);
          setIsPressActive(false);
          updateGestureAction("neutral");
        },
      }),
    [bounds.height, bounds.width, onRecordEnd, onRecordStart, position],
  );

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds({ width, height });

    const initialX = Math.max(EDGE_MARGIN, width - BUTTON_SIZE - initialRight);
    const initialY = Math.max(EDGE_MARGIN, height - BUTTON_SIZE - initialBottom);
    const shouldSnapRight = initialX + BUTTON_SIZE / 2 >= width / 2;
    const snappedX = shouldSnapRight
      ? Math.max(EDGE_MARGIN, width - BUTTON_SIZE - EDGE_MARGIN)
      : EDGE_MARGIN;
    const next = {
      x: snappedX,
      y: Math.min(
        Math.max(EDGE_MARGIN, initialY),
        Math.max(EDGE_MARGIN, height - BUTTON_SIZE - EDGE_MARGIN),
      ),
    };

    baseOffset.current = next;
    position.setValue(next);
  };

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={handleContainerLayout}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.buttonWrap,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { scale },
            ],
          },
        ]}
      >
        {isPressActive ? (
          <View pointerEvents="none" style={styles.arcOverlay}>
            <View
              style={[
                styles.arcZone,
                styles.arcSendZone,
                gestureAction === "send" && styles.arcSendZoneActive,
              ]}
            >
              <Feather
                name="arrow-up-circle"
                size={18}
                color={gestureAction === "send" ? "#FFFFFF" : "#1E7A45"}
              />
              <Text
                style={[
                  styles.arcLabel,
                  styles.arcSendLabel,
                  gestureAction === "send" && styles.arcLabelActive,
                ]}
              >
                松手发送
              </Text>
            </View>
            <View
              style={[
                styles.arcZone,
                styles.arcCancelZone,
                gestureAction === "cancel" && styles.arcCancelZoneActive,
              ]}
            >
              <Feather
                name="x-circle"
                size={18}
                color={gestureAction === "cancel" ? "#FFFFFF" : "#B83232"}
              />
              <Text
                style={[
                  styles.arcLabel,
                  styles.arcCancelLabel,
                  gestureAction === "cancel" && styles.arcLabelActive,
                ]}
              >
                松手取消
              </Text>
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.button,
            (isRecording || isPressActive) && styles.buttonRecording,
            gestureAction === "send" && styles.buttonSend,
            gestureAction === "cancel" && styles.buttonCancel,
            isDragging && styles.buttonDragging,
          ]}
        >
          <Feather
            name="users"
            size={24}
            color={isRecording || isPressActive ? "#FFFFFF" : "#1A1A1A"}
          />
          <Text
            style={[
              styles.label,
              (isRecording || isPressActive) && styles.labelRecording,
            ]}
          >
            {gestureAction === "send"
              ? "松手发送"
              : gestureAction === "cancel"
                ? "松手取消"
                : "模拟对方"}
          </Text>
        </View>
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
  buttonRecording: {
    backgroundColor: "#151619",
  },
  buttonSend: {
    backgroundColor: "#1E9E5A",
    borderColor: "rgba(30,158,90,0.25)",
  },
  buttonCancel: {
    backgroundColor: "#FF3B30",
    borderColor: "rgba(255,59,48,0.2)",
  },
  buttonDragging: {
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  labelRecording: {
    color: "#FFFFFF",
  },
  arcOverlay: {
    position: "absolute",
    width: ARC_SIZE,
    height: ARC_SIZE,
    left: -(ARC_SIZE - BUTTON_SIZE) / 2,
    top: -(ARC_SIZE - BUTTON_SIZE) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  arcZone: {
    position: "absolute",
    width: ARC_SIZE,
    height: ARC_SIZE / 2,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 6,
  },
  arcSendZone: {
    top: 0,
    borderTopLeftRadius: ARC_SIZE,
    borderTopRightRadius: ARC_SIZE,
    backgroundColor: "rgba(52,199,89,0.12)",
    borderWidth: 1,
    borderColor: "rgba(52,199,89,0.22)",
  },
  arcCancelZone: {
    bottom: 0,
    borderBottomLeftRadius: ARC_SIZE,
    borderBottomRightRadius: ARC_SIZE,
    backgroundColor: "rgba(255,59,48,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.2)",
  },
  arcSendZoneActive: {
    backgroundColor: "rgba(52,199,89,0.9)",
    borderColor: "rgba(52,199,89,0.95)",
  },
  arcCancelZoneActive: {
    backgroundColor: "rgba(255,59,48,0.9)",
    borderColor: "rgba(255,59,48,0.95)",
  },
  arcLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  arcSendLabel: {
    color: "#1E7A45",
  },
  arcCancelLabel: {
    color: "#B83232",
  },
  arcLabelActive: {
    color: "#FFFFFF",
  },
});

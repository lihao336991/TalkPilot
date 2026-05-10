import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";

export type AlertButtonVariant = "primary" | "cancel" | "destructive";

export type AlertButton = {
  text: string;
  variant?: AlertButtonVariant;
  onPress?: () => void;
};

export type AppAlertProps = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
};

const DEFAULT_BUTTON: AlertButton = {
  text: "OK",
  variant: "primary",
};

export function AppAlert({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: AppAlertProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.95);
    }
  }, [visible, opacity, scale]);

  const actionButtons = buttons && buttons.length > 0 ? buttons : [DEFAULT_BUTTON];
  const stacked = actionButtons.length > 2;

  function handlePress(button: AlertButton) {
    button.onPress?.();
    onDismiss?.();
  }

  function renderButton(button: AlertButton, index: number) {
    const isPrimary = button.variant === "primary" || !button.variant;
    const isCancel = button.variant === "cancel";
    const isDestructive = button.variant === "destructive";

    return (
      <TouchableOpacity
        key={index}
        activeOpacity={0.7}
        style={[
          s.buttonBase,
          stacked ? s.buttonStacked : s.buttonSide,
          isPrimary && s.buttonPrimary,
          isCancel && s.buttonCancel,
          isDestructive && s.buttonDestructive,
        ]}
        onPress={() => handlePress(button)}
      >
        <Text
          style={[
            s.buttonText,
            isPrimary && s.buttonPrimaryText,
            isCancel && s.buttonCancelText,
            isDestructive && s.buttonDestructiveText,
          ]}
        >
          {button.text}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[s.overlay, { opacity }]}>
        <Pressable style={s.dismissZone} onPress={onDismiss} />
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}
          <View style={stacked ? s.buttonColumn : s.buttonRow}>
            {actionButtons.map(renderButton)}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: palette.overlayDark,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxxl,
  },
  dismissZone: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: palette.bgCardSolid,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    width: "100%",
    maxWidth: 340,
    ...shadows.cardLg,
  },
  title: {
    ...typography.displaySm,
    color: palette.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodyMd,
    color: palette.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  buttonColumn: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  buttonBase: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    minHeight: 48,
  },
  buttonSide: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonStacked: {
    width: "100%",
  },
  buttonText: {
    ...typography.labelLg,
    textAlign: "center",
  },
  buttonPrimary: {
    backgroundColor: palette.accent,
  },
  buttonPrimaryText: {
    color: palette.textOnAccent,
  },
  buttonCancel: {
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  buttonCancelText: {
    color: palette.textSecondary,
  },
  buttonDestructive: {
    backgroundColor: palette.dangerLight,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
  },
  buttonDestructiveText: {
    color: palette.danger,
  },
});

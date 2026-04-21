import { useSessionStore } from "@/features/live/store/sessionStore";
import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const getTabBarHeight = (bottomInset: number) =>
  58 + Math.max(bottomInset - 8, 8);

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const sessionStatus = useSessionStore((s) => s.status);
  const isImmersiveLive =
    sessionStatus === "active" ||
    sessionStatus === "paused" ||
    sessionStatus === "calibrating";

  if (isImmersiveLive) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={[
          styles.surface,
          {
            minHeight: getTabBarHeight(insets.bottom),
            paddingBottom: Math.max(insets.bottom - 8, 8),
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          let iconName: keyof typeof Feather.glyphMap = "mic";
          if (route.name === "library") iconName = "clock";
          if (route.name === "community") iconName = "message-circle";
          if (route.name === "profile") iconName = "user";

          const isLiveTab = route.name === "index";

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              style={styles.tabItem}
            >
              {isLiveTab ? (
                /* Live tab — pill button */
                <View style={[styles.livePill, isFocused && styles.livePillActive]}>
                  <Feather
                    name="mic"
                    size={18}
                    color={isFocused ? palette.accentDeep : palette.accentDark}
                  />
                  <Text style={[styles.livePillLabel, isFocused && styles.livePillLabelActive]}>
                    Live
                  </Text>
                </View>
              ) : (
                /* Regular tabs */
                <View style={styles.tabInner}>
                  <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                    <Feather
                      name={iconName}
                      size={20}
                      color={isFocused ? palette.accentDark : palette.textTertiary}
                    />
                  </View>
                  <Text style={[styles.label, isFocused && styles.labelActive]}>
                    {label as string}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  surface: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    backgroundColor: palette.bgTabBar,
    borderTopWidth: 1,
    borderTopColor: palette.accentBorder,
    ...shadows.tabBar,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Regular tab */
  tabInner: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xs,
  },
  iconWrapActive: {
    backgroundColor: palette.accentMutedMid,
  },
  label: {
    ...typography.tabLabel,
    color: palette.textTertiary,
  },
  labelActive: {
    color: palette.accentDark,
  },
  /* Live pill */
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.accentMuted,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    marginBottom: 2,
  },
  livePillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  livePillLabel: {
    ...typography.labelLg,
    color: palette.accentDark,
  },
  livePillLabelActive: {
    color: palette.accentDeep,
  },
});

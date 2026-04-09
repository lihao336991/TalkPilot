import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const getTabBarHeight = (bottomInset: number) => 58 + Math.max(bottomInset - 8, 8);

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={[
          styles.surface,
          {
            minHeight: getTabBarHeight(insets.bottom),
            paddingBottom: Math.max(insets.bottom - 8, 8),
          },
        ]}>
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
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          let iconName: keyof typeof Feather.glyphMap = 'mic';
          if (route.name === 'library') iconName = 'clock';
          if (route.name === 'community') iconName = 'message-circle';
          if (route.name === 'profile') iconName = 'user';

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              style={styles.tabItem}>
              <Feather
                name={iconName}
                size={24}
                color={isFocused ? '#1A1A1A' : 'rgba(26,26,26,0.3)'}
                style={{ marginBottom: 4 }}
                strokeWidth={isFocused ? 2.5 : 1.5}
              />
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? '#1A1A1A' : 'rgba(26,26,26,0.3)' },
                ]}>
                {label as string}
              </Text>
              {isFocused && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  surface: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(245,242,237,0.96)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#151619',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 16,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1A1A1A',
  },
});

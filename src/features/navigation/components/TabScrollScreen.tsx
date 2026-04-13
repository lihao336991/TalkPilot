import { Feather } from '@expo/vector-icons';
import React from 'react';
import { SafeAreaView, ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarHeight } from '@/features/navigation/components/CustomTabBar';
import { TabScreenHeader } from '@/features/navigation/components/TabScreenHeader';

type TabScrollScreenProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  actionLabel?: string;
  onActionPress?: () => void;
  actionAccessibilityLabel?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function TabScrollScreen({
  children,
  title,
  subtitle,
  actionIcon,
  actionLabel,
  onActionPress,
  actionAccessibilityLabel,
  contentContainerStyle,
}: TabScrollScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <TabScreenHeader
        title={title}
        subtitle={subtitle}
        actionIcon={actionIcon}
        actionLabel={actionLabel}
        onActionPress={onActionPress}
        actionAccessibilityLabel={actionAccessibilityLabel}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: tabBarHeight + 32 },
          contentContainerStyle,
        ]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
});

import { CustomTabBar } from '@/features/navigation/components/CustomTabBar';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.tabs.live'),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('navigation.tabs.history'),
        }}
      />
      {/* <Tabs.Screen
        name="community"
        options={{
          title: 'Coach',
          href: null, // 二期实现前隐藏
        }}
      /> */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('navigation.tabs.profile'),
        }}
      />
    </Tabs>
  );
}

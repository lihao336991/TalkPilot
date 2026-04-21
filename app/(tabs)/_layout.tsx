import { CustomTabBar } from '@/features/navigation/components/CustomTabBar';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'History',
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
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

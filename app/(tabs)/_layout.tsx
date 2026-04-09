import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '@/features/navigation/components/CustomTabBar';

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
      <Tabs.Screen
        name="community"
        options={{
          title: 'Coach',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

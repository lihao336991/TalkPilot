import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TabScrollScreen } from '@/features/navigation/components/TabScrollScreen';

export default function CommunityScreen() {
  return (
    <TabScrollScreen
      title="Community"
      subtitle="Connect & Share"
      actionIcon="search"
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.emptyState}>
        <Feather name="message-square" size={48} color="#1A1A1A" style={styles.icon} />
        <Text style={styles.title}>Community coming soon</Text>
      </View>
    </TabScrollScreen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    color: '#1A1A1A',
    fontStyle: 'italic',
  },
});

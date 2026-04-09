import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type TabScreenHeaderProps = {
  title?: string;
  subtitle?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onActionPress?: () => void;
  actionAccessibilityLabel?: string;
};

export function TabScreenHeader({
  title = 'TalkPilot',
  subtitle = 'Real-Time English Copilot',
  actionIcon,
  onActionPress,
  actionAccessibilityLabel,
}: TabScreenHeaderProps) {
  const ActionContainer = onActionPress ? Pressable : View;

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {actionIcon ? (
        <ActionContainer
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole={onActionPress ? 'button' : undefined}
          onPress={onActionPress}
          style={styles.actionButton}>
          <Feather name={actionIcon} size={20} color="#1A1A1A" />
        </ActionContainer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: 'rgba(245,242,237,0.8)',
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: -1,
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 10,
    fontFamily: 'SpaceMono',
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: 'rgba(26,26,26,0.3)',
    marginTop: 4,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.05)',
  },
});

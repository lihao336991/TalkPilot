import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type StartSessionCardProps = {
  onStart: () => void;
  dailyMinutesUsed: number;
  dailyMinutesLimit: number;
  isLimitReached: boolean;
  selectedScene: string;
};

export function StartSessionCard({
  onStart,
  dailyMinutesUsed,
  dailyMinutesLimit,
  isLimitReached,
  selectedScene,
}: StartSessionCardProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const remaining = dailyMinutesLimit - dailyMinutesUsed;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Start Conversation</Text>

      <Pressable onPress={onStart} accessibilityLabel="Start conversation">
        <Animated.View style={[styles.startButton, pulseStyle]}>
          <Feather name="mic" size={32} color="#FFFFFF" />
        </Animated.View>
      </Pressable>

      <Text style={styles.remaining}>
        {isLimitReached
          ? "Today's free minutes are used up. Upgrade to continue."
          : `${remaining} min remaining today`}
      </Text>
      <View style={styles.sceneRow}>
        <Feather name="compass" size={14} color="rgba(26,26,26,0.68)" />
        <Text style={styles.sceneText}>{selectedScene}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  startButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#151619',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  remaining: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.68)',
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F2ED',
  },
  sceneText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.68)',
  },
});

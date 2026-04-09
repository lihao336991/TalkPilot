import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type SpeakerCalibrationProps = {
  visible: boolean;
  onComplete: (speakerId: number) => void;
  onSkip: () => void;
};

function WaveBar({ delay }: { delay: number }) {
  const height = useSharedValue(8);

  useEffect(() => {
    height.value = withRepeat(
      withSequence(
        withTiming(28, { duration: 400 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 400 + delay, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [height, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.waveBar, animatedStyle]} />;
}

export function SpeakerCalibration({ visible, onComplete, onSkip }: SpeakerCalibrationProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="mic" size={24} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>Speaker Calibration</Text>
          <Text style={styles.instruction}>
            Say "Hello, this is me" so we can identify your voice during the conversation.
          </Text>

          <View style={styles.waveContainer}>
            {[0, 80, 160, 240, 120].map((d, i) => (
              <WaveBar key={i} delay={d} />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.skipButton} onPress={onSkip} accessibilityLabel="Skip calibration">
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.doneButton}
              onPress={() => onComplete(0)}
              accessibilityLabel="Done calibration"
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    padding: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#151619',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  instruction: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(26,26,26,0.68)',
    textAlign: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    marginVertical: 8,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#151619',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(21,22,25,0.08)',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(26,26,26,0.68)',
  },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#151619',
    alignItems: 'center',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

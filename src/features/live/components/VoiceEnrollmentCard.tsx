import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { voiceEnrollmentService } from '../services/VoiceEnrollmentService';

type Phase = 'intro' | 'recording' | 'saving' | 'done';

type Props = {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
};

const RECORD_DURATION_MS = voiceEnrollmentService.getRecordingDurationMs();

export function VoiceEnrollmentCard({ visible, onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [countdown, setCountdown] = useState(Math.ceil(RECORD_DURATION_MS / 1000));
  const chunksRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPhase('intro');
      setCountdown(Math.ceil(RECORD_DURATION_MS / 1000));
      chunksRef.current = [];
    }
  }, [visible]);

  // Pulse animation while recording
  useEffect(() => {
    if (phase === 'recording') {
      scale.value = withRepeat(
        withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [phase, scale]);

  const startRecording = () => {
    chunksRef.current = [];
    setPhase('recording');
    setCountdown(Math.ceil(RECORD_DURATION_MS / 1000));

    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6, // VOICE_RECOGNITION
      bufferSize: 4096,
    });

    LiveAudioStream.on('data', (data: string) => {
      chunksRef.current.push(data);
    });

    LiveAudioStream.start();

    // Countdown ticker
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return Math.max(0, next);
      });
    }, 1000);

    // Auto-stop after duration
    stopTimeoutRef.current = setTimeout(() => {
      void stopRecording();
    }, RECORD_DURATION_MS);
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    try {
      LiveAudioStream.stop();
    } catch {}

    setPhase('saving');

    try {
      await voiceEnrollmentService.saveEnrollment(chunksRef.current);
    } catch (err) {
      console.error('[VoiceEnrollment] Failed to save enrollment:', err);
    }

    setPhase('done');
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onSkip}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Voice Setup</Text>
            <Pressable onPress={onSkip} hitSlop={12}>
              <Feather name="x" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {phase === 'intro' && (
            <>
              <Text style={styles.body}>
                Speak for {Math.ceil(RECORD_DURATION_MS / 1000)} seconds so the
                app can recognise your voice and separate it from your
                conversation partner's.
              </Text>
              <Text style={styles.hint}>
                You only need to do this once. Your sample is stored locally.
              </Text>
              <Pressable style={styles.primaryButton} onPress={startRecording}>
                <Feather name="mic" size={18} color="#FFF" />
                <Text style={styles.primaryButtonText}>Start Recording</Text>
              </Pressable>
              <Pressable onPress={onSkip}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            </>
          )}

          {phase === 'recording' && (
            <>
              <Text style={styles.body}>
                Keep talking naturally — anything works.
              </Text>
              <Animated.View style={[styles.recordingOrb, pulseStyle]}>
                <Feather name="mic" size={32} color="#FFF" />
              </Animated.View>
              <Text style={styles.countdown}>{countdown}s</Text>
            </>
          )}

          {phase === 'saving' && (
            <View style={styles.centeredRow}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.savingText}>Saving voice sample…</Text>
            </View>
          )}

          {phase === 'done' && (
            <>
              <View style={styles.doneIcon}>
                <Feather name="check" size={32} color="#FFF" />
              </View>
              <Text style={styles.body}>
                Voice sample saved. Your voice will be recognised automatically
                in every session.
              </Text>
              <Pressable style={styles.primaryButton} onPress={onComplete}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 28,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9CA3AF',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  recordingOrb: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
  },
  centeredRow: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  savingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  doneIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { voiceprintService } from '../services/VoiceprintService';
import type { LearningLanguage } from '@/shared/i18n/config';
import { useLocaleStore } from '@/shared/store/localeStore';

type Phase = 'intro' | 'recording' | 'saving' | 'error' | 'done';

type Props = {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
};

const RECORD_DURATION_MS = voiceEnrollmentService.getRecordingDurationMs();

const READ_ALOUD_PROMPTS: Record<LearningLanguage, string[]> = {
  en: [
    'Hi, I am practicing English with TalkPilot today.',
    'I would like to speak clearly and keep improving.',
  ],
  'zh-CN': [
    '你好，我今天正在用 TalkPilot 练习中文。',
    '我想说得更清楚，也想每天进步一点。',
  ],
  es: [
    'Hola, hoy estoy practicando español con TalkPilot.',
    'Quiero hablar con claridad y mejorar cada día.',
  ],
  ja: [
    'こんにちは、今日は TalkPilot で日本語を練習しています。',
    'はっきり話して、毎日少しずつ上達したいです。',
  ],
  ko: [
    '안녕하세요, 오늘 TalkPilot으로 한국어를 연습하고 있어요.',
    '또렷하게 말하고 매일 조금씩 나아지고 싶어요.',
  ],
  fr: [
    "Bonjour, aujourd'hui je pratique le français avec TalkPilot.",
    "Je veux parler clairement et m'améliorer chaque jour.",
  ],
  de: [
    'Hallo, ich übe heute Deutsch mit TalkPilot.',
    'Ich möchte klar sprechen und jeden Tag besser werden.',
  ],
  'pt-BR': [
    'Olá, hoje estou praticando português com o TalkPilot.',
    'Quero falar com clareza e melhorar um pouco todos os dias.',
  ],
};

export function VoiceEnrollmentCard({ visible, onComplete, onSkip }: Props) {
  const { t } = useTranslation();
  const learningLanguage = useLocaleStore((s) => s.learningLanguage);
  const readAloudPrompts = READ_ALOUD_PROMPTS[learningLanguage];
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
      await voiceprintService.createEnrollmentProfileFromChunks(chunksRef.current);
      setPhase('done');
    } catch (err) {
      console.error('[VoiceEnrollment] Failed to save enrollment:', err);
      await voiceEnrollmentService.clearEnrollmentProfile();
      setPhase('error');
      return;
    }
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
            <Text style={styles.title}>{t('live.voiceEnrollment.title')}</Text>
            <Pressable onPress={onSkip} hitSlop={12}>
              <Feather name="x" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {phase === 'intro' && (
            <>
              <Text style={styles.body}>
                {t('live.voiceEnrollment.introBody', {
                  seconds: Math.ceil(RECORD_DURATION_MS / 1000),
                })}
              </Text>
              <View style={styles.promptCard}>
                <Text style={styles.promptLabel}>
                  {t('live.voiceEnrollment.readAloudLabel')}
                </Text>
                {readAloudPrompts.map((line) => (
                  <Text key={line} style={styles.promptText}>
                    {line}
                  </Text>
                ))}
              </View>
              <Text style={styles.hint}>
                {t('live.voiceEnrollment.introHint')}
              </Text>
              <Pressable style={styles.primaryButton} onPress={startRecording}>
                <Feather name="mic" size={18} color="#FFF" />
                <Text style={styles.primaryButtonText}>
                  {t('common.actions.startRecording')}
                </Text>
              </Pressable>
              <Pressable onPress={onSkip}>
                <Text style={styles.skipText}>{t('live.voiceEnrollment.skipForNow')}</Text>
              </Pressable>
            </>
          )}

          {phase === 'recording' && (
            <>
              <Text style={styles.body}>
                {t('live.voiceEnrollment.recordingBody')}
              </Text>
              <View style={styles.promptCardCompact}>
                {readAloudPrompts.map((line) => (
                  <Text key={line} style={styles.promptTextCompact}>
                    {line}
                  </Text>
                ))}
              </View>
              <Animated.View style={[styles.recordingOrb, pulseStyle]}>
                <Feather name="mic" size={32} color="#FFF" />
              </Animated.View>
              <Text style={styles.countdown}>
                {t('live.voiceEnrollment.countdown', { count: countdown })}
              </Text>
            </>
          )}

          {phase === 'saving' && (
            <View style={styles.centeredRow}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.savingText}>{t('live.voiceEnrollment.saving')}</Text>
            </View>
          )}

          {phase === 'error' && (
            <>
              <View style={[styles.doneIcon, styles.errorIcon]}>
                <Feather name="alert-triangle" size={32} color="#FFF" />
              </View>
              <Text style={styles.body}>
                {t('live.voiceEnrollment.errorBody')}
              </Text>
              <Pressable style={styles.primaryButton} onPress={startRecording}>
                <Text style={styles.primaryButtonText}>
                  {t('live.voiceEnrollment.retryAction')}
                </Text>
              </Pressable>
              <Pressable onPress={onSkip}>
                <Text style={styles.skipText}>{t('live.voiceEnrollment.skipForNow')}</Text>
              </Pressable>
            </>
          )}

          {phase === 'done' && (
            <>
              <View style={styles.doneIcon}>
                <Feather name="check" size={32} color="#FFF" />
              </View>
              <Text style={styles.body}>
                {t('live.voiceEnrollment.doneBody')}
              </Text>
              <Pressable style={styles.primaryButton} onPress={onComplete}>
                <Text style={styles.primaryButtonText}>{t('common.actions.continue')}</Text>
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
  promptCard: {
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  promptCardCompact: {
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  promptLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: '#111827',
  },
  promptTextCompact: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#111827',
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
  errorIcon: {
    backgroundColor: '#F59E0B',
  },
});

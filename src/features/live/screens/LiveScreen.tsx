import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSessionStore } from '@/features/live/store/sessionStore';
import { useConversationStore } from '@/features/live/store/conversationStore';
import { useSuggestionStore } from '@/features/live/store/suggestionStore';
import { useReviewStore } from '@/features/live/store/reviewStore';

import { StartSessionCard } from '../components/StartSessionCard';
import { ConversationFlow } from '../components/ConversationFlow';
import { ConversationToolbar } from '../components/ConversationToolbar';
import SuggestionPanel from '../components/SuggestionPanel';
import { SpeakerCalibration } from '../components/SpeakerCalibration';

import { AudioEngine, audioEngine } from '../services/AudioEngine';
import { deepgramService } from '../services/DeepgramStreamingService';
import { deepgramTokenService } from '../services/DeepgramTokenService';
import { suggestionService } from '../services/SuggestionService';
import { reviewService } from '../services/ReviewService';

import { getTabBarHeight } from '@/features/navigation/components/CustomTabBar';

export default function LiveScreen() {
  const insets = useSafeAreaInsets();

  const status = useSessionStore((s) => s.status);
  const scenePreset = useSessionStore((s) => s.scenePreset);
  const sceneDescription = useSessionStore((s) => s.sceneDescription);
  const dailyMinutesUsed = useSessionStore((s) => s.dailyMinutesUsed);
  const dailyMinutesLimit = useSessionStore((s) => s.dailyMinutesLimit);
  const startSession = useSessionStore((s) => s.startSession);
  const pauseSession = useSessionStore((s) => s.pauseSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const endSession = useSessionStore((s) => s.endSession);

  const isListening = useConversationStore((s) => s.isListening);
  const setListening = useConversationStore((s) => s.setListening);
  const setSelfSpeakerId = useConversationStore((s) => s.setSelfSpeakerId);

  const [duration, setDuration] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);

  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'active') return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const handleUtteranceEnd = useCallback(
    (speaker: 'self' | 'other', text: string) => {
      if (!sessionIdRef.current || !text.trim()) return;

      const scene = sceneDescription || scenePreset;

      if (speaker === 'other') {
        suggestionService.fetchSuggestions(sessionIdRef.current, text, scene);
      }

      if (speaker === 'self') {
        const turnId = `${Date.now()}`;
        reviewService.fetchReview(sessionIdRef.current, text, scene, turnId);
      }
    },
    [scenePreset, sceneDescription],
  );

  const sendAudioRef = useRef((base64: string) => {
    deepgramService.sendAudio(base64);
  });

  const startStreaming = useCallback(
    async (speakerId: number | null) => {
      setSelfSpeakerId(speakerId);
      setShowCalibration(false);

      const sessionId =
        Date.now().toString(36) + Math.random().toString(36).slice(2);
      sessionIdRef.current = sessionId;
      startSession(sessionId);

      const token = await deepgramTokenService.getToken();
      deepgramService.connect(token, handleUtteranceEnd);
      audioEngine.start(sendAudioRef.current);
      setListening(true);
    },
    [startSession, setSelfSpeakerId, setListening, handleUtteranceEnd],
  );

  const handleStartSession = useCallback(async () => {
    const granted = await AudioEngine.requestPermission();
    if (!granted) return;

    audioEngine.init();
    setShowCalibration(true);
  }, []);

  const handleCalibrationComplete = useCallback(
    (speakerId: number) => {
      startStreaming(speakerId);
    },
    [startStreaming],
  );

  const handleCalibrationSkip = useCallback(() => {
    startStreaming(null);
  }, [startStreaming]);

  const handlePause = useCallback(() => {
    audioEngine.stop();
    pauseSession();
    setListening(false);
  }, [pauseSession, setListening]);

  const handleResume = useCallback(() => {
    audioEngine.start(sendAudioRef.current);
    resumeSession();
    setListening(true);
  }, [resumeSession, setListening]);

  const handleEnd = useCallback(() => {
    audioEngine.stop();
    deepgramService.disconnect();
    endSession();
    setListening(false);
    setDuration(0);
    sessionIdRef.current = null;
  }, [endSession, setListening]);

  const isIdle = status === 'idle' || status === 'ended';
  const isActive =
    status === 'active' || status === 'paused' || status === 'calibrating';

  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: getTabBarHeight(insets.bottom) }]}
      edges={['top']}
    >
      {isIdle && (
        <StartSessionCard
          onStart={handleStartSession}
          dailyMinutesUsed={dailyMinutesUsed}
          dailyMinutesLimit={dailyMinutesLimit}
          selectedScene={scenePreset}
        />
      )}

      {isActive && (
        <View style={styles.activeContainer}>
          <ConversationFlow />
          <SuggestionPanel />
          <ConversationToolbar
            onPause={handlePause}
            onResume={handleResume}
            onEnd={handleEnd}
            isPaused={status === 'paused'}
            duration={duration}
          />
        </View>
      )}

      <SpeakerCalibration
        visible={showCalibration}
        onComplete={handleCalibrationComplete}
        onSkip={handleCalibrationSkip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
  },
  activeContainer: {
    flex: 1,
  },
});

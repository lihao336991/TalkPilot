import { getValidAccessToken } from '@/shared/api/supabase';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const ASSIST_TTS_MODE: 'local' | 'cloud' = 'local';
const LOCAL_TTS_LANGUAGE = 'en-US';
const SpeechModule = (() => {
  try {
    return require('expo-speech') as
      | {
          speak: (
            text: string,
            options?: {
              language?: string;
              pitch?: number;
              rate?: number;
              onDone?: () => void;
              onStopped?: () => void;
              onError?: (error: unknown) => void;
            },
          ) => void;
          stop?: () => void;
        }
      | null;
  } catch {
    return null;
  }
})();

export type AssistReplyResult = {
  sourceText: string;
  englishReply: string;
  hint: string | null;
  audioBase64: string | null;
  audioMimeType: string | null;
  ttsMode: 'local' | 'cloud';
};

class AssistReplyService {
  private sound: Audio.Sound | null = null;
  private outputFileUri = `${FileSystem.cacheDirectory ?? ''}assist-reply.mp3`;

  async translateTranscript(
    transcript: string,
    sceneHint: string,
  ): Promise<AssistReplyResult> {
    const sourceText = transcript.trim();
    if (!sourceText) {
      throw new Error('Assist transcript is empty');
    }

    const shouldUseCloudTts = ASSIST_TTS_MODE === 'cloud' || !SpeechModule?.speak;
    const accessToken = await getValidAccessToken();

    const response = await fetch(`${supabaseUrl}/functions/v1/assist-reply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: sourceText,
        scene_hint: sceneHint,
        tts_mode: shouldUseCloudTts ? 'cloud' : 'none',
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      console.error('[AssistReply] Function error response:', payload);
      const detail = payload?.error ?? payload?.message ?? `status ${response.status}`;
      throw new Error(`Assist reply failed: ${detail}`);
    }

    return {
      sourceText: payload.source_text ?? sourceText,
      englishReply: payload.english_reply ?? '',
      hint: payload.hint ?? null,
      audioBase64: payload.audio_base64 ?? null,
      audioMimeType: payload.audio_mime_type ?? null,
      ttsMode: shouldUseCloudTts ? 'cloud' : 'local',
    };
  }

  async playReply(result: AssistReplyResult): Promise<void> {
    if (ASSIST_TTS_MODE === 'local' && SpeechModule?.speak) {
      await this.stopPlayback();

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: true,
        });
      } catch (e) {
        console.warn('[AssistReply] Failed to set audio mode for TTS:', e);
      }

      await new Promise<void>((resolve, reject) => {
        SpeechModule.speak(result.englishReply, {
          language: LOCAL_TTS_LANGUAGE,
          rate: 0.98,
          pitch: 1,
          onDone: resolve,
          onStopped: resolve,
          onError: reject,
        });
      });
      return;
    }

    if (!result.audioBase64 || !this.outputFileUri) {
      return;
    }

    await this.stopPlayback();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
    });

    await FileSystem.writeAsStringAsync(this.outputFileUri, result.audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { sound } = await Audio.Sound.createAsync({ uri: this.outputFileUri }, { shouldPlay: true });
    this.sound = sound;

    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          resolve();
        }
      });
    });
  }

  async stopPlayback(): Promise<void> {
    try {
      SpeechModule?.stop?.();
    } catch {}

    if (!this.sound) {
      return;
    }

    const sound = this.sound;
    this.sound = null;
    try {
      await sound.stopAsync();
    } catch {}
    await sound.unloadAsync();
  }
}

export const assistReplyService = new AssistReplyService();

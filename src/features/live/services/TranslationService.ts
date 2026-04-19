import { invokeEdgeFunction } from '@/shared/api/request';
import { getValidAccessToken } from '@/shared/api/supabase';
import { useConversationStore } from '@/features/live/store/conversationStore';
import {
  getDeepgramLanguage,
  getDeviceLanguageTag,
} from '@/shared/locale/deviceLanguage';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

export type TranslationDirection = 'to_en' | 'to_native';

type TranslatePayload = {
  turnId: string;
  text: string;
  direction: TranslationDirection;
  sceneHint?: string;
};

type TranslationResponse = {
  translated_text?: string;
  english_reply?: string;
  hint?: string | null;
  direction?: TranslationDirection;
  target_language?: string;
  audio_base64?: string | null;
  audio_mime_type?: string | null;
};

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

class TranslationService {
  private sound: Audio.Sound | null = null;
  private outputFileUri = `${FileSystem.cacheDirectory ?? ''}translation-reply.mp3`;

  /**
   * Translate a turn's text and attach the result to that turn in the store.
   * Non-blocking: status transitions go idle -> loading -> done/error.
   */
  async translate({
    turnId,
    text,
    direction,
    sceneHint,
  }: TranslatePayload): Promise<void> {
    const source = text.trim();
    if (!source) {
      return;
    }

    const store = useConversationStore.getState();
    store.setTurnTranslation(turnId, {
      translation: undefined,
      translationStatus: 'loading',
      translationDirection: direction,
    });

    try {
      const accessToken = await getValidAccessToken();
      const targetLanguage =
        direction === 'to_native' ? getDeepgramLanguage() : 'en';

      const { data } = await invokeEdgeFunction<TranslationResponse>({
        functionName: 'assist-reply',
        accessToken,
        body: {
          transcript: source,
          scene_hint: sceneHint ?? '',
          direction,
          target_language: targetLanguage,
          tts_mode: 'none',
        },
      });

      const translated =
        data.translated_text?.trim() || data.english_reply?.trim() || '';

      if (!translated) {
        useConversationStore.getState().setTurnTranslation(turnId, {
          translationStatus: 'error',
        });
        return;
      }

      useConversationStore.getState().setTurnTranslation(turnId, {
        translation: translated,
        translationStatus: 'done',
        translationDirection: direction,
      });
    } catch (error) {
      console.error('[Translation] Failed to translate turn', turnId, error);
      useConversationStore.getState().setTurnTranslation(turnId, {
        translationStatus: 'error',
      });
    }
  }

  /**
   * Speak an English string aloud so the other party can hear it.
   * Prefers on-device TTS (free, offline) and falls back silently if unavailable.
   */
  async speakEnglish(text: string): Promise<void> {
    const spoken = text.trim();
    if (!spoken) return;

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
      console.warn('[Translation] Failed to set audio mode for TTS:', e);
    }

    if (SpeechModule?.speak) {
      await new Promise<void>((resolve) => {
        SpeechModule.speak(spoken, {
          language: 'en-US',
          rate: 0.98,
          pitch: 1,
          onDone: resolve,
          onStopped: resolve,
          onError: (error) => {
            console.warn('[Translation] Local TTS error:', error);
            resolve();
          },
        });
      });
    }
  }

  /**
   * Speak arbitrary text in the user's native language (for translating other->native playback, rare use).
   */
  async speakNative(text: string): Promise<void> {
    const spoken = text.trim();
    if (!spoken || !SpeechModule?.speak) return;

    await this.stopPlayback();

    const lang = getDeviceLanguageTag();
    await new Promise<void>((resolve) => {
      SpeechModule.speak(spoken, {
        language: lang,
        rate: 0.98,
        pitch: 1,
        onDone: resolve,
        onStopped: resolve,
        onError: (error) => {
          console.warn('[Translation] Native TTS error:', error);
          resolve();
        },
      });
    });
  }

  async stopPlayback(): Promise<void> {
    try {
      SpeechModule?.stop?.();
    } catch {}

    if (!this.sound) return;
    const sound = this.sound;
    this.sound = null;
    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.unloadAsync();
    } catch {}
  }

  // Reserved for future cloud TTS playback via base64 audio.
  // Kept here so we have one place to manage playback lifecycle.
  async playBase64Audio(audioBase64: string): Promise<void> {
    if (!audioBase64) return;

    await this.stopPlayback();
    await FileSystem.writeAsStringAsync(this.outputFileUri, audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: this.outputFileUri },
      { shouldPlay: true },
    );
    this.sound = sound;

    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) resolve();
      });
    });
  }
}

export const translationService = new TranslationService();

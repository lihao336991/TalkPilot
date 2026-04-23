import { invokeEdgeFunction } from '@/shared/api/request';
import { getValidAccessToken } from '@/shared/api/supabase';
import { useConversationStore } from '@/features/live/store/conversationStore';
import { useLocaleStore } from '@/shared/store/localeStore';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

export type TranslationDirection = 'to_learning' | 'to_native';

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

function getNativeLanguageTag(): string {
  return useLocaleStore.getState().uiLocale;
}

function getLearningLanguageTag(): string {
  return useLocaleStore.getState().learningLanguage;
}

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
          getAvailableVoicesAsync?: () => Promise<
            Array<{ identifier: string; language: string; name?: string }>
          >;
        }
      | null;
  } catch {
    return null;
  }
})();

class TranslationService {
  private sound: Audio.Sound | null = null;
  private outputFileUri = `${FileSystem.cacheDirectory ?? ''}translation-reply.mp3`;
  private voiceCache = new Map<string, boolean>();

  private async hasVoiceForLanguage(languageTag: string): Promise<boolean> {
    if (this.voiceCache.has(languageTag)) {
      return this.voiceCache.get(languageTag)!;
    }

    if (!SpeechModule?.getAvailableVoicesAsync) {
      this.voiceCache.set(languageTag, true);
      return true;
    }

    try {
      const voices = await SpeechModule.getAvailableVoicesAsync();
      const primary = languageTag.split('-')[0].toLowerCase();
      const hasVoice = voices.some((v) => {
        const voicePrimary = v.language.split('-')[0].toLowerCase();
        return voicePrimary === primary;
      });
      this.voiceCache.set(languageTag, hasVoice);
      console.log(`[TTS] Voice check for ${languageTag}: ${hasVoice ? 'available' : 'missing'}`);
      return hasVoice;
    } catch {
      this.voiceCache.set(languageTag, true);
      return true;
    }
  }

  /**
   * Translate a turn's text via the Google translator-backed Edge Function
   * and attach the result to that turn in the store.
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
      const targetLanguage = getNativeLanguageTag();

      const { data } = await invokeEdgeFunction<TranslationResponse>({
        functionName: 'assist-reply',
        accessToken,
        body: {
          transcript: source,
          scene_hint: sceneHint ?? '',
          direction,
          target_language: targetLanguage,
          learning_language: getLearningLanguageTag(),
          native_language: getNativeLanguageTag(),
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
   * Speak a learning-language string aloud so the other party can hear it.
   * Prefers on-device TTS (free, offline) and skips silently if no voice pack is available.
   */
  async speakLearning(text: string): Promise<void> {
    const spoken = text.trim();
    if (!spoken) return;

    const learningLanguageTag = getLearningLanguageTag();
    const hasVoice = await this.hasVoiceForLanguage(learningLanguageTag);
    if (!hasVoice) {
      console.log('[TTS] Skipping speakLearning: no system voice for', learningLanguageTag);
      return;
    }

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
          language: learningLanguageTag,
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
   * Skips silently if no system voice pack is available.
   */
  async speakNative(text: string): Promise<void> {
    const spoken = text.trim();
    if (!spoken || !SpeechModule?.speak) return;

    const lang = getNativeLanguageTag();
    const hasVoice = await this.hasVoiceForLanguage(lang);
    if (!hasVoice) {
      console.log('[TTS] Skipping speakNative: no system voice for', lang);
      return;
    }

    await this.stopPlayback();

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

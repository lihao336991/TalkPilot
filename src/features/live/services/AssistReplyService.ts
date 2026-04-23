import { translationService } from '@/features/live/services/TranslationService';
import { invokeEdgeFunction } from '@/shared/api/request';
import { getValidAccessToken } from '@/shared/api/supabase';
import { useLocaleStore } from '@/shared/store/localeStore';

export type AssistReplyResult = {
  sourceText: string;
  learningTranslation: string;
  hint: string | null;
};

class AssistReplyService {
  async translateTranscript(
    transcript: string,
    sceneHint: string,
  ): Promise<AssistReplyResult> {
    const sourceText = transcript.trim();
    if (!sourceText) {
      throw new Error('Assist transcript is empty');
    }

    const accessToken = await getValidAccessToken();
    const learningLanguage = useLocaleStore.getState().learningLanguage;
    const { data } = await invokeEdgeFunction<{
      source_text?: string;
      translated_text?: string;
      english_reply?: string | null;
      hint?: string | null;
    }>({
      functionName: 'assist-reply',
      accessToken,
      body: {
        transcript: sourceText,
        scene_hint: sceneHint,
        direction: 'to_learning',
        target_language: learningLanguage,
        learning_language: learningLanguage,
        tts_mode: 'none',
      },
    });

    const learningReply =
      data.translated_text?.trim() || data.english_reply?.trim() || '';
    if (!learningReply) {
      throw new Error('Failed to translate to the learning language');
    }

    return {
      sourceText: data.source_text?.trim() || sourceText,
      learningTranslation: learningReply,
      hint: data.hint ?? null,
    };
  }

  async playReply(result: AssistReplyResult): Promise<void> {
    if (!result.learningTranslation.trim()) {
      return;
    }
    await translationService.speakLearning(result.learningTranslation);
  }

  async stopPlayback(): Promise<void> {
    await translationService.stopPlayback();
  }
}

export const assistReplyService = new AssistReplyService();

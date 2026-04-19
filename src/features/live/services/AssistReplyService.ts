import { translationService } from '@/features/live/services/TranslationService';
import { invokeEdgeFunction } from '@/shared/api/request';
import { getValidAccessToken } from '@/shared/api/supabase';

export type AssistReplyResult = {
  sourceText: string;
  englishReply: string;
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
        direction: 'to_en',
        target_language: 'en',
        tts_mode: 'none',
      },
    });

    const englishReply =
      data.translated_text?.trim() || data.english_reply?.trim() || '';
    if (!englishReply) {
      throw new Error('Failed to generate English reply');
    }

    return {
      sourceText: data.source_text?.trim() || sourceText,
      englishReply,
      hint: data.hint ?? null,
    };
  }

  async playReply(result: AssistReplyResult): Promise<void> {
    if (!result.englishReply.trim()) {
      return;
    }
    await translationService.speakEnglish(result.englishReply);
  }

  async stopPlayback(): Promise<void> {
    await translationService.stopPlayback();
  }
}

export const assistReplyService = new AssistReplyService();

import { useConversationStore } from '@/features/live/store/conversationStore';
import { useDebugStore } from '@/features/live/store/debugStore';
import { useReviewStore, type ReviewResult } from '@/features/live/store/reviewStore';
import { useAuthStore } from '@/shared/store/authStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

function getLlmMetaDetail(headers: Headers): string {
  const provider = headers.get('x-llm-provider');
  const model = headers.get('x-llm-model');
  const keyPrefix = headers.get('x-llm-key-prefix');
  const parts = [provider, model, keyPrefix ? `key ${keyPrefix}` : null].filter(Boolean);

  return parts.join(' · ');
}

type ReviewApiResponse = {
  overall_score?: 'green' | 'yellow' | 'red';
  issues?: ReviewResult['issues'];
  better_expression?: string | null;
  praise?: string | null;
};

function mapReviewResponse(result: ReviewApiResponse): ReviewResult {
  return {
    overallScore: result.overall_score ?? 'green',
    issues: result.issues ?? [],
    betterExpression: result.better_expression ?? null,
    praise: result.praise ?? null,
  };
}

export class ReviewService {
  async fetchReview(sessionId: string, userUtterance: string, scene: string, turnId: string): Promise<void> {
    const store = useReviewStore.getState();
    const accessToken = useAuthStore.getState().accessToken;
    const conversationStore = useConversationStore.getState();

    store.setLoading(true);

    try {
      console.log('[Review] Fetching for turn', turnId);
      const response = await fetch(`${supabaseUrl}/functions/v1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId, userUtterance, scene, turnId }),
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('[Review] Error from server:', errorData);
          detail = errorData?.error ?? errorData?.message ?? detail;
        } catch {
          console.error('[Review] Error from server: HTTP', response.status);
        }
        useDebugStore.getState().failTurnLlm(turnId, detail);
        store.setLoading(false);
        return;
      }

      const llmMeta = getLlmMetaDetail(response.headers);
      const rawResult: ReviewApiResponse = await response.json();
      const result = mapReviewResponse(rawResult);

      console.log('[Review] Score:', result.overallScore);
      useDebugStore
        .getState()
        .completeTurnLlm(
          turnId,
          [llmMeta, `score ${result.overallScore}`].filter(Boolean).join(' · '),
        );
      store.setReview(turnId, result);
      conversationStore.setTurnReview(turnId, result);
      store.setLoading(false);
    } catch (error) {
      console.error('[Review] Failed:', error);
      useDebugStore
        .getState()
        .failTurnLlm(turnId, error instanceof Error ? error.message : 'Review request failed');
      store.setLoading(false);
    }
  }
}

export const reviewService = new ReviewService();

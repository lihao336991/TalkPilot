import { useConversationStore } from '@/features/live/store/conversationStore';
import { useAccessStore } from '@/features/live/store/accessStore';
import { useDebugStore } from '@/features/live/store/debugStore';
import { useReviewStore, type ReviewResult } from '@/features/live/store/reviewStore';
import {
  normalizeFeatureAccess,
  toFeatureAccessError,
} from '@/shared/billing/access';
import { invokeEdgeFunction } from '@/shared/api/request';
import type { FeatureAccessEnvelope } from '@/shared/billing/accessTypes';
import { useAuthStore } from '@/shared/store/authStore';

function getLlmMetaDetail(headers: Headers): string {
  const provider = headers.get('x-llm-provider');
  const model = headers.get('x-llm-model');
  const keyPrefix = headers.get('x-llm-key-prefix');
  const parts = [provider, model, keyPrefix ? `key ${keyPrefix}` : null].filter(Boolean);

  return parts.join(' · ');
}

type ReviewApiResponse = FeatureAccessEnvelope & {
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
      const { data: rawResult, headers } = await invokeEdgeFunction<ReviewApiResponse>({
        functionName: 'review',
        accessToken,
        body: { sessionId, userUtterance, scene, turnId },
      });
      const access = normalizeFeatureAccess(rawResult, 'review');
      if (access) {
        useAccessStore.getState().setFeatureAccess(access);
      }
      const llmMeta = getLlmMetaDetail(headers);
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
      const accessError = toFeatureAccessError(error, 'review');
      if (accessError) {
        useAccessStore.getState().setFeatureAccess(accessError.access);
      }
      console.error('[Review] Failed:', error);
      useDebugStore
        .getState()
        .failTurnLlm(turnId, error instanceof Error ? error.message : 'Review request failed');
      store.setLoading(false);
      throw accessError ?? error;
    }
  }
}

export const reviewService = new ReviewService();

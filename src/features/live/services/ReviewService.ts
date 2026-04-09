import { useAuthStore } from '@/shared/store/authStore';
import { useReviewStore, type ReviewResult } from '@/features/live/store/reviewStore';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

export class ReviewService {
  async fetchReview(sessionId: string, userUtterance: string, scene: string, turnId: string): Promise<void> {
    const store = useReviewStore.getState();
    const accessToken = useAuthStore.getState().accessToken;

    store.setLoading(true);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId, userUtterance, scene, turnId }),
      });

      if (!response.ok) {
        store.setLoading(false);
        return;
      }

      const result: ReviewResult = await response.json();
      store.setReview(turnId, result);
    } catch {
      store.setLoading(false);
    }
  }
}

export const reviewService = new ReviewService();

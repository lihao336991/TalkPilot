import { create } from 'zustand';

export type ReviewIssue = {
  type: 'grammar' | 'vocabulary' | 'naturalness';
  original: string;
  corrected: string;
  explanation: string;
};

export type ReviewResult = {
  overallScore: 'green' | 'yellow' | 'red';
  issues: ReviewIssue[];
  betterExpression: string | null;
  praise: string | null;
};

type ReviewState = {
  currentReview: ReviewResult | null;
  isLoading: boolean;
  reviewHistory: Map<string, ReviewResult>;

  setReview: (turnId: string, review: ReviewResult) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
};

export const useReviewStore = create<ReviewState>((set) => ({
  currentReview: null,
  isLoading: false,
  reviewHistory: new Map(),

  setReview: (turnId, review) =>
    set((state) => {
      const newHistory = new Map(state.reviewHistory);
      newHistory.set(turnId, review);
      return { currentReview: review, reviewHistory: newHistory };
    }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  clear: () =>
    set({ currentReview: null, isLoading: false, reviewHistory: new Map() }),
}));

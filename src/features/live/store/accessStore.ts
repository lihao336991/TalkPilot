import { create } from 'zustand';

import type { FeatureAccessSummary, FeatureKey } from '@/shared/billing/accessTypes';

type AccessStoreState = {
  accessByFeature: Partial<Record<FeatureKey, FeatureAccessSummary>>;
  setFeatureAccess: (summary: FeatureAccessSummary) => void;
  clear: () => void;
};

export const useAccessStore = create<AccessStoreState>((set) => ({
  accessByFeature: {},

  setFeatureAccess: (summary) =>
    set((state) => ({
      accessByFeature: {
        ...state.accessByFeature,
        [summary.feature]: summary,
      },
    })),

  clear: () =>
    set({ accessByFeature: {} }),
}));

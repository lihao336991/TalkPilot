import { create } from 'zustand';

export type SubscriptionTier = 'free' | 'pro' | 'pro_plus';

interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscriptionTier: SubscriptionTier;
  accessToken: string | null;

  setUser: (userId: string, accessToken: string) => void;
  setSubscriptionTier: (tier: SubscriptionTier) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
  reset: () => void;
}

const initialState = {
  userId: null as string | null,
  isAuthenticated: false,
  isLoading: false,
  subscriptionTier: 'free' as SubscriptionTier,
  accessToken: null as string | null,
};

export const useAuthStore = create<AuthState>()((set) => ({
  ...initialState,

  setUser: (userId, accessToken) =>
    set({ userId, accessToken, isAuthenticated: true }),

  setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),

  setLoading: (isLoading) => set({ isLoading }),

  signOut: () =>
    set({
      userId: null,
      accessToken: null,
      isAuthenticated: false,
      subscriptionTier: 'free',
    }),

  reset: () => set(initialState),
}));

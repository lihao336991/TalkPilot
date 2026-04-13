import { create } from 'zustand';

export type SubscriptionTier = 'free' | 'pro' | 'unlimited';
export type AuthMode = 'anonymous' | 'authenticated';
export type AuthProviderName = 'anonymous' | 'apple' | 'google' | null;

type SessionPayload = {
  userId: string;
  accessToken: string;
  authMode: AuthMode;
  provider: AuthProviderName;
  userEmail?: string | null;
  displayName?: string | null;
};

interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscriptionTier: SubscriptionTier;
  accessToken: string | null;
  authMode: AuthMode | null;
  provider: AuthProviderName;
  userEmail: string | null;
  displayName: string | null;

  setSession: (payload: SessionPayload) => void;
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
  authMode: null as AuthMode | null,
  provider: null as AuthProviderName,
  userEmail: null as string | null,
  displayName: null as string | null,
};

export const useAuthStore = create<AuthState>()((set) => ({
  ...initialState,

  setSession: ({
    userId,
    accessToken,
    authMode,
    provider,
    userEmail = null,
    displayName = null,
  }) =>
    set({
      userId,
      accessToken,
      authMode,
      provider,
      userEmail,
      displayName,
      isAuthenticated: authMode === 'authenticated',
    }),

  setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),

  setLoading: (isLoading) => set({ isLoading }),

  signOut: () =>
    set({
      userId: null,
      accessToken: null,
      authMode: null,
      provider: null,
      userEmail: null,
      displayName: null,
      isAuthenticated: false,
      subscriptionTier: 'free',
    }),

  reset: () => set(initialState),
}));

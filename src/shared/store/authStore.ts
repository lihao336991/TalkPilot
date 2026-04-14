import { create } from 'zustand';

export type SubscriptionTier = 'free' | 'pro' | 'unlimited';
export type SubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'billing_issue'
  | 'expired';
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
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  subscriptionProvider: string | null;
  revenuecatAppUserId: string | null;
  canManageSubscription: boolean;
  accessToken: string | null;
  authMode: AuthMode | null;
  provider: AuthProviderName;
  userEmail: string | null;
  displayName: string | null;

  setSession: (payload: SessionPayload) => void;
  setSubscriptionSummary: (payload: {
    tier: SubscriptionTier;
    status?: SubscriptionStatus;
    expiresAt?: string | null;
    subscriptionProvider?: string | null;
    revenuecatAppUserId?: string | null;
  }) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
  reset: () => void;
}

const initialState = {
  userId: null as string | null,
  isAuthenticated: false,
  isLoading: false,
  subscriptionTier: 'free' as SubscriptionTier,
  subscriptionStatus: 'inactive' as SubscriptionStatus,
  subscriptionExpiresAt: null as string | null,
  subscriptionProvider: null as string | null,
  revenuecatAppUserId: null as string | null,
  canManageSubscription: false,
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
      canManageSubscription: authMode === 'authenticated',
    }),

  setSubscriptionSummary: ({
    tier,
    status = 'inactive',
    expiresAt = null,
    subscriptionProvider = null,
    revenuecatAppUserId = null,
  }) =>
    set({
      subscriptionTier: tier,
      subscriptionStatus: status,
      subscriptionExpiresAt: expiresAt,
      subscriptionProvider,
      revenuecatAppUserId,
    }),

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
      subscriptionStatus: 'inactive',
      subscriptionExpiresAt: null,
      subscriptionProvider: null,
      revenuecatAppUserId: null,
      canManageSubscription: false,
    }),

  reset: () => set(initialState),
}));

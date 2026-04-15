import { create } from 'zustand';

export type SubscriptionTier = 'free' | 'pro' | 'unlimited';
export type SubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'billing_issue'
  | 'expired'
  | 'syncing';
export type PersistedSubscriptionStatus = Exclude<SubscriptionStatus, 'syncing'>;
export type SubscriptionSyncState = 'synced' | 'syncing';
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
  profileSubscriptionTier: SubscriptionTier;
  profileSubscriptionStatus: PersistedSubscriptionStatus;
  profileSubscriptionExpiresAt: string | null;
  profileSubscriptionProvider: string | null;
  profileRevenuecatAppUserId: string | null;
  hasLocalProEntitlement: boolean;
  localRevenuecatAppUserId: string | null;
  localSubscriptionExpiresAt: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionSyncState: SubscriptionSyncState;
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
    status?: PersistedSubscriptionStatus;
    expiresAt?: string | null;
    subscriptionProvider?: string | null;
    revenuecatAppUserId?: string | null;
  }) => void;
  setRevenueCatEntitlement: (payload: {
    hasPro: boolean;
    expiresAt?: string | null;
    revenuecatAppUserId?: string | null;
  }) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
  reset: () => void;
}

function deriveSubscriptionState(args: {
  profileSubscriptionTier: SubscriptionTier;
  profileSubscriptionStatus: PersistedSubscriptionStatus;
  profileSubscriptionExpiresAt: string | null;
  profileSubscriptionProvider: string | null;
  profileRevenuecatAppUserId: string | null;
  hasLocalProEntitlement: boolean;
  localRevenuecatAppUserId: string | null;
  localSubscriptionExpiresAt: string | null;
}) {
  const profileHasPaidAccess =
    args.profileSubscriptionTier === 'pro' ||
    args.profileSubscriptionTier === 'unlimited';

  if (args.hasLocalProEntitlement) {
    return {
      subscriptionTier: profileHasPaidAccess ? args.profileSubscriptionTier : 'pro',
      subscriptionStatus: profileHasPaidAccess ? args.profileSubscriptionStatus : 'syncing',
      subscriptionSyncState: profileHasPaidAccess ? 'synced' : 'syncing',
      subscriptionExpiresAt:
        args.profileSubscriptionExpiresAt ?? args.localSubscriptionExpiresAt,
      subscriptionProvider: args.profileSubscriptionProvider ?? 'revenuecat',
      revenuecatAppUserId:
        args.profileRevenuecatAppUserId ?? args.localRevenuecatAppUserId,
    };
  }

  return {
    subscriptionTier: args.profileSubscriptionTier,
    subscriptionStatus: args.profileSubscriptionStatus,
    subscriptionSyncState: 'synced' as SubscriptionSyncState,
    subscriptionExpiresAt: args.profileSubscriptionExpiresAt,
    subscriptionProvider: args.profileSubscriptionProvider,
    revenuecatAppUserId: args.profileRevenuecatAppUserId,
  };
}

const initialState = {
  userId: null as string | null,
  isAuthenticated: false,
  isLoading: false,
  profileSubscriptionTier: 'free' as SubscriptionTier,
  profileSubscriptionStatus: 'inactive' as PersistedSubscriptionStatus,
  profileSubscriptionExpiresAt: null as string | null,
  profileSubscriptionProvider: null as string | null,
  profileRevenuecatAppUserId: null as string | null,
  hasLocalProEntitlement: false,
  localRevenuecatAppUserId: null as string | null,
  localSubscriptionExpiresAt: null as string | null,
  subscriptionTier: 'free' as SubscriptionTier,
  subscriptionStatus: 'inactive' as SubscriptionStatus,
  subscriptionSyncState: 'synced' as SubscriptionSyncState,
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
    set((state) => {
      const profileState = {
        profileSubscriptionTier: tier,
        profileSubscriptionStatus: status,
        profileSubscriptionExpiresAt: expiresAt,
        profileSubscriptionProvider: subscriptionProvider,
        profileRevenuecatAppUserId: revenuecatAppUserId,
      };

      return {
        ...profileState,
        ...deriveSubscriptionState({
          ...profileState,
          hasLocalProEntitlement: state.hasLocalProEntitlement,
          localRevenuecatAppUserId: state.localRevenuecatAppUserId,
          localSubscriptionExpiresAt: state.localSubscriptionExpiresAt,
        }),
      };
    }),

  setRevenueCatEntitlement: ({
    hasPro,
    expiresAt = null,
    revenuecatAppUserId = null,
  }) =>
    set((state) => {
      const localState = {
        hasLocalProEntitlement: hasPro,
        localSubscriptionExpiresAt: hasPro ? expiresAt : null,
        localRevenuecatAppUserId: hasPro ? revenuecatAppUserId : null,
      };

      return {
        ...localState,
        ...deriveSubscriptionState({
          profileSubscriptionTier: state.profileSubscriptionTier,
          profileSubscriptionStatus: state.profileSubscriptionStatus,
          profileSubscriptionExpiresAt: state.profileSubscriptionExpiresAt,
          profileSubscriptionProvider: state.profileSubscriptionProvider,
          profileRevenuecatAppUserId: state.profileRevenuecatAppUserId,
          ...localState,
        }),
      };
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
      profileSubscriptionTier: 'free',
      profileSubscriptionStatus: 'inactive',
      profileSubscriptionExpiresAt: null,
      profileSubscriptionProvider: null,
      profileRevenuecatAppUserId: null,
      hasLocalProEntitlement: false,
      localRevenuecatAppUserId: null,
      localSubscriptionExpiresAt: null,
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      subscriptionSyncState: 'synced',
      subscriptionExpiresAt: null,
      subscriptionProvider: null,
      revenuecatAppUserId: null,
      canManageSubscription: false,
    }),

  reset: () => set(initialState),
}));

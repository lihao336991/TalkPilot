import { getAppleSignInCredentials } from '@/shared/auth/providers/appleAuth';
import { invokeEdgeFunction } from '@/shared/api/request';
import { logBillingEvent } from '@/shared/billing/logger';
import { getRequiredEnv } from '@/shared/config/env';
import {
    clearGoogleSignInSession,
    configureGoogleSignIn,
    getGoogleSignInCredentials,
} from '@/shared/auth/providers/googleAuth';
import { supabaseStorage } from '@/shared/auth/supabaseStorage';
import { createClient, type Session } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import {
    refreshLiveMinutesAccess,
    resetLiveAccessState,
    syncSubscriptionTierToUsageLimit,
} from '../repositories/billingRepository';
import {
    type AuthMode,
    type AuthProviderName,
    type SubscriptionTier,
    getBillingStateSnapshot,
    useAuthStore,
} from '../store/authStore';

function getSupabaseProjectRef(url: string) {
  try {
    return new URL(url).host.split('.')[0] || null;
  } catch {
    return null;
  }
}

function decodeBase64(input: string) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < input.length; i += 1) {
    const value = chars.indexOf(input[i]);
    if (value < 0 || value === 64) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeBase64(normalized)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSessionIssuerRef(session: Session | null) {
  const payload = session?.access_token
    ? decodeJwtPayload(session.access_token)
    : null;
  return typeof payload?.iss === 'string'
    ? getSupabaseProjectRef(payload.iss)
    : null;
}

const expectedSupabaseProjectRef = getSupabaseProjectRef(
  getRequiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
);
const supabaseAuthStorageKey = expectedSupabaseProjectRef
  ? `talkpilot-${expectedSupabaseProjectRef}-auth-token`
  : 'talkpilot-auth-token';

export function getSupabaseClientDiagnostics() {
  return {
    expectedProjectRef: expectedSupabaseProjectRef,
    authStorageKey: supabaseAuthStorageKey,
    configuredUrl: getRequiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
  };
}

export const supabase = createClient(
  getRequiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
  getRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: supabaseStorage,
      storageKey: supabaseAuthStorageKey,
    },
  },
);

let authSubscriptionInitialized = false;
let authAutoRefreshBound = false;
let recoverSessionPromise: Promise<Session | null> | null = null;
let guestSessionPromise: Promise<Session | null> | null = null;
let guestFallbackSuppressed = false;
const SESSION_REFRESH_BUFFER_MS = 60_000;

function syncAutoRefreshState(appState: AppStateStatus) {
  if (appState === 'active') {
    supabase.auth.startAutoRefresh();
    return;
  }

  supabase.auth.stopAutoRefresh();
}

function bindAutoRefreshLifecycle() {
  if (authAutoRefreshBound) {
    return;
  }

  syncAutoRefreshState(AppState.currentState);
  AppState.addEventListener('change', syncAutoRefreshState);
  authAutoRefreshBound = true;
}

function normalizeSubscriptionTier(
  tier: string | null | undefined,
): SubscriptionTier {
  if (tier === 'pro' || tier === 'unlimited') {
    return tier;
  }

  return 'free';
}

function normalizeSubscriptionStatus(status: string | null | undefined) {
  if (
    status === 'active' ||
    status === 'trialing' ||
    status === 'canceled' ||
    status === 'billing_issue' ||
    status === 'expired'
  ) {
    return status;
  }

  return 'inactive';
}

async function syncProfile(session: Session) {
  const displayName = getDisplayNameFromSession(session);
  logBillingEvent('profile_sync_started', {
    userId: session.user.id,
    authMode: getAuthMode(session),
  });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'display_name, subscription_tier, subscription_status, subscription_expires_at, subscription_provider, revenuecat_app_user_id',
    )
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    await supabase.from('profiles').insert({
      id: session.user.id,
      display_name: displayName,
      subscription_tier: 'free',
    });
  } else if (!profile.display_name && displayName) {
    // Avoid clobbering any name the user might set later; only backfill if missing.
    await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', session.user.id);
  }

  const { data: refreshedProfile } = await supabase
    .from('profiles')
    .select(
      'subscription_tier, subscription_status, subscription_expires_at, subscription_provider, revenuecat_app_user_id',
    )
    .eq('id', session.user.id)
    .maybeSingle();

  const subscriptionTier = normalizeSubscriptionTier(
    refreshedProfile?.subscription_tier,
  );

  useAuthStore.getState().setSubscriptionSummary({
    tier: subscriptionTier,
    status: normalizeSubscriptionStatus(refreshedProfile?.subscription_status),
    expiresAt: refreshedProfile?.subscription_expires_at ?? null,
    subscriptionProvider: refreshedProfile?.subscription_provider ?? null,
    revenuecatAppUserId: refreshedProfile?.revenuecat_app_user_id ?? null,
  });
  syncSubscriptionTierToUsageLimit(subscriptionTier);

  try {
    await refreshLiveMinutesAccess(session.user.id);
  } catch (error) {
    console.warn('[Billing] Failed to refresh live minutes access:', error);
  }

  logBillingEvent('profile_sync_completed', {
    userId: session.user.id,
    ...getBillingStateSnapshot(useAuthStore.getState()),
  });
}

function getDisplayNameFromSession(session: Session): string | null {
  const metadata = session.user.user_metadata ?? {};
  const fullName =
    metadata.full_name ??
    metadata.name ??
    [metadata.given_name, metadata.family_name].filter(Boolean).join(' ');

  return typeof fullName === 'string' && fullName.trim().length > 0
    ? fullName.trim()
    : null;
}

function normalizeProvider(session: Session): AuthProviderName {
  if (session.user.is_anonymous) {
    return 'anonymous';
  }

  const provider = session.user.app_metadata?.provider;
  if (provider === 'apple' || provider === 'google') {
    return provider;
  }

  return null;
}

function getAuthMode(session: Session): AuthMode {
  return session.user.is_anonymous ? 'anonymous' : 'authenticated';
}

async function applySession(session: Session | null) {
  const { setSession, signOut } = useAuthStore.getState();

  if (!session) {
    resetLiveAccessState();
    signOut();
    return;
  }

  const previousUserId = useAuthStore.getState().userId;
  if (previousUserId !== session.user.id) {
    resetLiveAccessState();
  }

  setSession({
    userId: session.user.id,
    accessToken: session.access_token,
    authMode: getAuthMode(session),
    provider: normalizeProvider(session),
    userEmail: session.user.email ?? null,
    displayName: getDisplayNameFromSession(session),
  });
  await syncProfile(session);
}

async function recoverValidSession(): Promise<Session | null> {
  if (recoverSessionPromise) {
    return recoverSessionPromise;
  }

  recoverSessionPromise = (async () => {
    const { data } = await supabase.auth.getSession();
    let session = data.session;

    const sessionIssuerRef = getSessionIssuerRef(session);
    if (
      session &&
      expectedSupabaseProjectRef &&
      sessionIssuerRef !== expectedSupabaseProjectRef
    ) {
      console.warn('[Auth] Discarding Supabase session from unexpected project:', {
        expected: expectedSupabaseProjectRef,
        actual: sessionIssuerRef,
      });
      await supabase.auth.signOut({ scope: 'local' });
      session = null;
    }

    const expiresAtMs = (session?.expires_at ?? 0) * 1000;
    const hasEnoughTtl =
      session?.access_token &&
      expiresAtMs > Date.now() + SESSION_REFRESH_BUFFER_MS;

    if (session && !hasEnoughTtl) {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        await supabase.auth.signOut();
        session = null;
      } else {
        session = refreshData.session;
      }
    }

    return session;
  })();

  try {
    return await recoverSessionPromise;
  } finally {
    recoverSessionPromise = null;
  }
}

async function signInGuest(): Promise<Session | null> {
  const { data: anonData, error } = await supabase.auth.signInAnonymously();
  if (error) {
    if (error.message === 'Anonymous sign-ins are disabled') {
      throw new Error(
        'Supabase 匿名登录未开启，请在 Dashboard -> Authentication -> Providers -> Anonymous 中启用。',
      );
    }
    throw error;
  }

  return anonData.session;
}

export async function signInAsGuestIfNeeded(): Promise<Session | null> {
  if (guestSessionPromise) {
    return guestSessionPromise;
  }

  guestSessionPromise = (async () => {
    const session = await recoverValidSession();
    if (session) {
      return session;
    }

    return signInGuest();
  })();

  try {
    return await guestSessionPromise;
  } finally {
    guestSessionPromise = null;
  }
}

export async function getValidAccessToken(): Promise<string> {
  const session =
    (await recoverValidSession()) ?? (await signInAsGuestIfNeeded());
  if (!session?.access_token) {
    throw new Error('No valid Supabase session');
  }
  return session.access_token;
}

export async function refreshProfileFromSession() {
  const session = await recoverValidSession();
  logBillingEvent('profile_refresh_requested', {
    userId: session?.user.id ?? null,
  });
  await applySession(session);
}

export async function reconcileRevenueCatCustomer() {
  const session = await recoverValidSession();

  if (!session || session.user.is_anonymous) {
    logBillingEvent('reconcile_skipped', {
      reason: 'missing_or_anonymous_session',
      userId: session?.user.id ?? null,
    });
    return null;
  }

  logBillingEvent('reconcile_requested', {
    userId: session.user.id,
    ...getBillingStateSnapshot(useAuthStore.getState()),
  });

  try {
    const { data } = await invokeEdgeFunction<{
      ok: boolean;
      status: string;
      is_active: boolean;
      entitlement_id: string;
      product_id: string | null;
      expires_at: string | null;
    }>({
      functionName: 'revenuecat-sync-customer',
      accessToken: session.access_token,
      body: {},
    });

    logBillingEvent('reconcile_succeeded', {
      userId: session.user.id,
      response: data,
    });
    await refreshProfileFromSession();
    logBillingEvent('reconcile_state_applied', {
      userId: session.user.id,
      ...getBillingStateSnapshot(useAuthStore.getState()),
    });
    return data;
  } catch (error) {
    logBillingEvent(
      'reconcile_failed',
      {
        userId: session.user.id,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
        ...getBillingStateSnapshot(useAuthStore.getState()),
      },
      'error',
    );
    throw error;
  }
}

async function signInWithIdTokenSession(args: {
  provider: 'apple' | 'google';
  token: string;
  nonce?: string;
}) {
  const { data, error } = await supabase.auth.signInWithIdToken(args);

  if (error || !data.session) {
    throw error ?? new Error(`Failed to sign in with ${args.provider}.`);
  }

  return data.session;
}

async function replaceCurrentSessionWithAccount(
  signIn: () => Promise<Session>,
) {
  const { data } = await supabase.auth.getSession();
  const currentSession = data.session;

  guestFallbackSuppressed = true;

  try {
    if (currentSession) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    }

    const session = await signIn();
    await applySession(session);
    return session;
  } finally {
    guestFallbackSuppressed = false;
  }
}

export async function signInWithApple() {
  return replaceCurrentSessionWithAccount(async () => {
    const credentials = await getAppleSignInCredentials();
    return signInWithIdTokenSession({
      provider: 'apple',
      token: credentials.token,
    });
  });
}

export async function signInWithGoogle() {
  return replaceCurrentSessionWithAccount(async () => {
    configureGoogleSignIn();
    const credentials = await getGoogleSignInCredentials();
    return signInWithIdTokenSession({
      provider: 'google',
      token: credentials.token,
    });
  });
}

export async function signOut() {
  await clearGoogleSignInSession();

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }

  const guestSession = await signInAsGuestIfNeeded();
  await applySession(guestSession);
}

export async function resetLocalSupabaseSession() {
  recoverSessionPromise = null;
  guestSessionPromise = null;
  guestFallbackSuppressed = false;
  await supabase.auth.signOut({ scope: 'local' });
  useAuthStore.getState().signOut();
  resetLiveAccessState();
  const guestSession = await signInGuest();
  await applySession(guestSession);
  return guestSession;
}

export const initAuth = async () => {
  const { setLoading } = useAuthStore.getState();

  setLoading(true);
  bindAutoRefreshLifecycle();

  try {
    const session =
      (await recoverValidSession()) ?? (await signInAsGuestIfNeeded());
    await applySession(session);
  } finally {
    setLoading(false);
  }

  if (!authSubscriptionInitialized) {
    supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (session) {
          await applySession(session);
          return;
        }

        if (guestFallbackSuppressed) {
          useAuthStore.getState().signOut();
          return;
        }

        const guestSession = await signInAsGuestIfNeeded();
        await applySession(guestSession);
      })();
    });
    authSubscriptionInitialized = true;
  }
};

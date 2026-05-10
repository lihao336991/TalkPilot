function requirePublicEnv(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }
  return trimmed;
}

export const publicAppEnv =
  process.env.EXPO_PUBLIC_APP_ENV?.trim() ||
  (__DEV__ ? "development" : "production");

export const publicSupabaseUrl = requirePublicEnv(
  "EXPO_PUBLIC_SUPABASE_URL",
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);

export const publicSupabaseAnonKey = requirePublicEnv(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const publicGoogleIosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";

export const publicGoogleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";

export const publicSentryDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || "";

export const publicSentryEnvironment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
  (__DEV__ ? "development" : "production");

export const publicPosthogApiKey =
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || "";

export const publicPosthogHost =
  process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || "https://app.posthog.com";

export const publicPosthogDisabled =
  process.env.EXPO_PUBLIC_POSTHOG_DISABLED?.trim() || "";

export const publicPosthogDevEnabled =
  process.env.EXPO_PUBLIC_POSTHOG_DEV_ENABLED?.trim() || "";

export const publicRevenueCatIosKey =
  process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS?.trim() || "";

export const publicRevenueCatAndroidKey =
  process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_ANDROID?.trim() || "";

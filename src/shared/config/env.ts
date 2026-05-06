function getExpoPublicEnv(name: string): string | undefined {
  switch (name) {
    case 'EXPO_PUBLIC_SUPABASE_URL':
      return process.env.EXPO_PUBLIC_SUPABASE_URL;
    case 'EXPO_PUBLIC_SUPABASE_ANON_KEY':
      return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    case 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID':
      return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    case 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID':
      return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    default:
      return process.env[name];
  }
}

export function getRequiredEnv(name: string) {
  const value = getExpoPublicEnv(name)?.trim();
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }

  return value;
}

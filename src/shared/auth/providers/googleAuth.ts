import {
  GoogleSignin,
} from '@react-native-google-signin/google-signin';
import { getRequiredEnv } from '@/shared/config/env';
import { Platform } from 'react-native';

let googleConfigured = false;

export function configureGoogleSignIn() {
  if (googleConfigured) {
    return;
  }

  GoogleSignin.configure({
    iosClientId: getRequiredEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
    webClientId: getRequiredEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  });

  googleConfigured = true;
}

function getIdTokenFromResponse(
  response: unknown,
) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if ('data' in response) {
    const data = response.data;
    if (data && typeof data === 'object' && 'idToken' in data) {
      const token = data.idToken;
      return typeof token === 'string' && token.length > 0 ? token : null;
    }
  }

  if ('idToken' in response && typeof response.idToken === 'string') {
    return response.idToken;
  }

  return null;
}

export async function getGoogleSignInCredentials() {
  if (Platform.OS !== 'ios') {
    throw new Error('Google 登录当前仅在 iOS 完成接入。');
  }

  try {
    await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    const token = getIdTokenFromResponse(response);

    if (!token) {
      throw new Error('Google 登录未返回 id token。');
    }

    return { token };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code.toUpperCase().includes('CANCEL')
    ) {
      throw new Error('你已取消 Google 登录。');
    }

    throw error;
  }
}

export async function clearGoogleSignInSession() {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut().catch(() => null);
    await GoogleSignin.revokeAccess().catch(() => null);
  } catch {
    // Best-effort cleanup; Supabase session is the source of truth.
  }
}

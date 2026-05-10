import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { AuthFlowError } from '@/shared/auth/authErrors';

export async function getAppleSignInCredentials() {
  if (Platform.OS !== 'ios') {
    throw new AuthFlowError('appleUnsupportedPlatform');
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new AuthFlowError('appleUnavailable');
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new AuthFlowError('appleMissingToken');
    }

    return {
      token: credential.identityToken,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'ERR_REQUEST_CANCELED'
    ) {
      throw new AuthFlowError('appleCancelled');
    }

    throw error;
  }
}

import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export async function getAppleSignInCredentials() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple 登录当前仅支持 iOS。');
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('当前设备不支持 Apple 登录。');
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple 登录未返回 identity token。');
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
      throw new Error('你已取消 Apple 登录。');
    }

    throw error;
  }
}

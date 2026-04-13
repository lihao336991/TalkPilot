import React, { useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { signInWithApple, signInWithGoogle } from '@/shared/api/supabase';

type AuthActionPanelProps = {
  onSuccess?: () => void | Promise<void>;
};

export function AuthActionPanel({ onSuccess }: AuthActionPanelProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<'apple' | 'google' | null>(null);

  const isSupportedPlatform = useMemo(() => Platform.OS === 'ios', []);

  async function handleSignIn(provider: 'apple' | 'google') {
    setErrorMessage(null);
    setPendingProvider(provider);

    try {
      if (provider === 'apple') {
        await signInWithApple();
      } else {
        await signInWithGoogle();
      }

      await onSuccess?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '登录失败，请稍后重试。');
    } finally {
      setPendingProvider(null);
    }
  }

  if (!isSupportedPlatform) {
    return (
      <View style={styles.unsupportedCard}>
        <Text style={styles.unsupportedTitle}>iOS only for now</Text>
        <Text style={styles.unsupportedBody}>
          Apple and Google sign-in are currently enabled for the iOS build in this first release.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={16}
        onPress={() => void handleSignIn('apple')}
        style={styles.appleButton}
      />

      <Pressable
        disabled={pendingProvider !== null}
        onPress={() => void handleSignIn('google')}
        style={({ pressed }) => [
          styles.googleButton,
          pressed && pendingProvider === null ? styles.googleButtonPressed : null,
          pendingProvider !== null ? styles.buttonDisabled : null,
        ]}>
        {pendingProvider === 'google' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={styles.googleButtonContent}>
            <FontAwesome name="google" size={18} color="#FFFFFF" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </View>
        )}
      </Pressable>

      {pendingProvider === 'apple' ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.inlineLoadingText}>Completing Apple sign-in...</Text>
        </View>
      ) : null}

      <Text style={styles.legalHint}>
        By continuing, you agree to use your Apple or Google account on this device.
      </Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  googleButton: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F1F22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  googleButtonPressed: {
    opacity: 0.8,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inlineLoadingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  legalHint: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.42)',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#FF9B88',
  },
  unsupportedCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  unsupportedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unsupportedBody: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.68)',
  },
});

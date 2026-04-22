import React, { useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { signInWithApple, signInWithGoogle } from '@/shared/api/supabase';
import { palette, radii, spacing, typography } from '@/shared/theme/tokens';

type AuthActionPanelProps = {
  onSuccess?: () => void | Promise<void>;
};

export function AuthActionPanel({ onSuccess }: AuthActionPanelProps) {
  const { t } = useTranslation();
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
      setErrorMessage(
        error instanceof Error ? error.message : t('auth.login.fallbackError'),
      );
    } finally {
      setPendingProvider(null);
    }
  }

  if (!isSupportedPlatform) {
    return (
      <View style={styles.unsupportedCard}>
        <Text style={styles.unsupportedTitle}>{t('auth.login.unsupportedTitle')}</Text>
        <Text style={styles.unsupportedBody}>
          {t('auth.login.unsupportedBody')}
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
          <ActivityIndicator color={palette.textOnAccent} />
        ) : (
          <View style={styles.googleButtonContent}>
            <FontAwesome name="google" size={18} color={palette.textOnAccent} />
            <Text style={styles.googleButtonText}>{t('auth.login.googleButton')}</Text>
          </View>
        )}
      </Pressable>

      {pendingProvider === 'apple' ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color={palette.textPrimary} />
          <Text style={styles.inlineLoadingText}>{t('auth.login.appleLoading')}</Text>
        </View>
      ) : null}

      <Text style={styles.legalHint}>
        {t('auth.login.legalHint')}
      </Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md + 2,
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  googleButton: {
    height: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
  },
  googleButtonPressed: {
    opacity: 0.8,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  googleButtonText: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: palette.textOnAccent,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  inlineLoadingText: {
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  legalHint: {
    marginTop: 2,
    ...typography.caption,
    lineHeight: 16,
    textAlign: 'center',
    color: palette.textTertiary,
  },
  errorText: {
    ...typography.bodySm,
    lineHeight: 20,
    color: palette.danger,
  },
  unsupportedCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: spacing.sm,
  },
  unsupportedTitle: {
    ...typography.bodyMd,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  unsupportedBody: {
    ...typography.bodySm,
    lineHeight: 20,
    color: palette.textSecondary,
  },
});

import { useAuthStore } from '@/shared/store/authStore';
import { palette } from '@/shared/theme/tokens';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { revenueCatService } from '../services/RevenueCatService';

export default function CustomerCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const authMode = useAuthStore((state) => state.authMode);
  const userId = useAuthStore((state) => state.userId);

  useEffect(() => {
    if (authMode !== 'authenticated' || !userId) {
      router.replace('/login');
      return;
    }

    void revenueCatService.configureForAuthenticatedUser(userId).catch((error) => {
      console.error('[RevenueCat] Failed to configure customer center:', error);
    });
  }, [authMode, router, userId]);

  function closeScreen() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  }

  if (Platform.OS === 'web') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.unsupportedContainer}>
          <Text style={styles.unsupportedTitle}>
            {t('billing.customerCenter.unsupportedTitle')}
          </Text>
          <Text style={styles.unsupportedBody}>
            {t('billing.customerCenter.unsupportedBody')}
          </Text>
          <Pressable onPress={closeScreen} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('common.actions.close')}</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) + 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('billing.customerCenter.closeAccessibilityLabel')}
            onPress={closeScreen}
            style={styles.iconButton}>
            <Feather name="arrow-left" size={20} color={palette.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{t('billing.customerCenter.title')}</Text>
            <Text style={styles.subtitle}>
              {t('billing.customerCenter.subtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <RevenueCatUI.CustomerCenterView
            style={styles.customerCenter}
            shouldShowCloseButton={false}
            onDismiss={closeScreen}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  unsupportedContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: palette.bgBase,
    gap: 16,
  },
  unsupportedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  unsupportedBody: {
    fontSize: 15,
    lineHeight: 24,
    color: palette.textSecondary,
  },
  closeButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.textPrimary,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  headerCopy: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: palette.textSecondary,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  customerCenter: {
    flex: 1,
  },
});

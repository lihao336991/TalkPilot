import { useAuthStore } from '@/shared/store/authStore';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { revenueCatService } from '../services/RevenueCatService';

export default function CustomerCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
          <Text style={styles.unsupportedTitle}>Customer center is mobile-only</Text>
          <Text style={styles.unsupportedBody}>
            Open the iOS or Android build to manage subscriptions with RevenueCat UI.
          </Text>
          <Pressable onPress={closeScreen} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
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
            accessibilityLabel="Close customer center"
            onPress={closeScreen}
            style={styles.iconButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Manage subscription</Text>
            <Text style={styles.subtitle}>
              Review your plan, restore purchases, or manage billing actions from RevenueCat Customer Center.
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
    backgroundColor: '#050505',
  },
  unsupportedContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#050505',
    gap: 16,
  },
  unsupportedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unsupportedBody: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.7)',
  },
  closeButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#050505',
  },
  header: {
    paddingHorizontal: 20,
    gap: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCopy: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.68)',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  customerCenter: {
    flex: 1,
  },
});

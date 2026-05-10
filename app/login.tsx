import React, { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthActionPanel } from '@/shared/auth/components/AuthActionPanel';
import { useAuthStore } from '@/shared/store/authStore';
import { palette, radii, shadows, spacing, typography } from '@/shared/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const authMode = useAuthStore((state) => state.authMode);
  const [isClosing, setIsClosing] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const floatingOpacity = useRef(new Animated.Value(0)).current;
  const closeScale = useRef(new Animated.Value(0.94)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(36)).current;

  useEffect(() => {
    if (authMode === 'authenticated' && !isClosing) {
      closeSheet();
    }
  }, [authMode, isClosing]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(floatingOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(closeScale, {
        toValue: 1,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, closeScale, floatingOpacity, sheetOpacity, sheetTranslateY]);

  function closeSheet() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(floatingOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(closeScale, {
        toValue: 0.96,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 28,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/profile');
      }
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <Animated.View
          pointerEvents="box-none"
          style={[styles.backdropContainer, { opacity: backdropOpacity }]}>
          <Pressable
            accessibilityRole="button"
            disabled={isClosing}
            onPress={() => closeSheet()}
            style={styles.backdrop}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.closeButtonWrap,
            {
              top: Math.max(insets.top + 12, 56),
              opacity: floatingOpacity,
              transform: [{ scale: closeScale }],
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.login.closeAccessibilityLabel')}
            disabled={isClosing}
            onPress={() => closeSheet()}
            style={styles.closeButton}>
            <Feather name="x" size={20} color={palette.textSecondary} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.centerMark, { opacity: floatingOpacity }]} />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 18) + 18,
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}>
          <Text style={styles.sheetTitle}>{t('auth.login.title')}</Text>
          <Text style={styles.sheetSubtitle}>
            {t('auth.login.subtitle')}
          </Text>
          <AuthActionPanel onSuccess={() => closeSheet()} />
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.bgTabBar,
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButtonWrap: {
    position: 'absolute',
    right: spacing.xxl,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    ...shadows.cardSm,
  },
  centerMark: {
    position: 'absolute',
    top: '45.6%',
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: palette.accentDark,
  },
  sheet: {
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.bgCardSolid,
    borderTopWidth: 1,
    borderColor: palette.accentBorderStrong,
    gap: spacing.sm + 2,
  },
  sheetTitle: {
    ...typography.displaySm,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: palette.textPrimary,
  },
  sheetSubtitle: {
    marginBottom: 2,
    ...typography.labelMd,
    lineHeight: 18,
    textAlign: 'center',
    color: palette.textSecondary,
  },
});

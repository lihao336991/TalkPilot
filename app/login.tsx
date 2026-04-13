import React, { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
            accessibilityLabel="Close login"
            disabled={isClosing}
            onPress={() => closeSheet()}
            style={styles.closeButton}>
            <Feather name="x" size={20} color="rgba(20,20,20,0.56)" />
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
          <Text style={styles.sheetTitle}>Continue with your account</Text>
          <Text style={styles.sheetSubtitle}>
            Use Apple or Google to keep your progress synced on this device.
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
    backgroundColor: 'rgba(232,232,232,0.96)',
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButtonWrap: {
    position: 'absolute',
    right: 24,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  centerMark: {
    position: 'absolute',
    top: '45.6%',
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#050505',
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 16,
    paddingHorizontal: 14,
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  sheetSubtitle: {
    marginBottom: 2,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.58)',
  },
});

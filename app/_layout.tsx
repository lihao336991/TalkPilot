import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import "../global.css";

import { revenueCatService } from "@/features/billing/services/RevenueCatService";
import { initAuth } from "@/shared/api/supabase";
import { useColorScheme } from "@/shared/hooks/useColorScheme";
import {
  Sentry,
  sentryNavigationIntegration,
} from "@/shared/monitoring/sentry";
import { useAuthStore } from "@/shared/store/authStore";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    let mounted = true;

    initAuth()
      .catch((authError) => {
        console.error("[Auth] Failed to initialize auth:", authError);
      })
      .finally(() => {
        if (mounted) {
          setAuthReady(true);
          console.log("[Auth] Auth initialized successfully.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loaded && authReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authReady]);

  if (!loaded || !authReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const authMode = useAuthStore((state) => state.authMode);
  const userId = useAuthStore((state) => state.userId);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    sentryNavigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    if (authMode === "authenticated" && userId) {
      Sentry.setUser({ id: userId });
      return;
    }

    Sentry.setUser(null);
  }, [authMode, userId]);

  useEffect(() => {
    if (authMode !== "authenticated" || !userId) {
      return;
    }

    void revenueCatService
      .configureForAuthenticatedUser(userId)
      .catch((error) => {
        console.error("[RevenueCat] Failed to configure purchases:", error);
      });
  }, [authMode, userId]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="customer-center"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="terms"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="(dev)/test" options={{ title: "TalkPilot Dev" }} />
      </Stack>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);

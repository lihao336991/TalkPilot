import { Platform } from "react-native";
import Constants from "expo-constants";

let posthog: any | null = null;
let initialized = false;
let lastScreenName: string | null = null;

type AnalyticsProps = Record<string, unknown>;

function shouldEnableAnalytics(): boolean {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim();
  if (!apiKey) {
    return false;
  }

  // Default: do not send dev traffic unless explicitly enabled.
  if (__DEV__ && process.env.EXPO_PUBLIC_POSTHOG_DEV_ENABLED !== "true") {
    return false;
  }

  if (process.env.EXPO_PUBLIC_POSTHOG_DISABLED === "true") {
    return false;
  }

  return true;
}

function getPostHogConfig() {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() ?? "";
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || "https://app.posthog.com";
  return { apiKey, host };
}

function safeTruncate(value: unknown, maxLen = 160): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}...` : trimmed;
}

function getAppContext(): AnalyticsProps {
  const expoConfig = Constants.expoConfig;
  const appVersion = expoConfig?.version ?? null;
  const runtimeVersion = expoConfig?.runtimeVersion ?? null;

  return {
    app_env: process.env.APP_ENV ?? (__DEV__ ? "development" : "production"),
    platform: Platform.OS,
    app_version: appVersion,
    runtime_version: runtimeVersion,
    is_dev: __DEV__,
  };
}

export const analytics = {
  init(): void {
    if (initialized) {
      return;
    }

    initialized = true;

    if (!shouldEnableAnalytics()) {
      return;
    }

    try {
      // Lazy import so the app can still run without the dependency installed.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PostHog } = require("posthog-react-native");

      const { apiKey, host } = getPostHogConfig();
      posthog = new PostHog(apiKey, {
        host,
        // Keep behavior explicit; avoid surprising captures.
        captureApplicationLifecycleEvents: true,
      });

      posthog.register?.(getAppContext());
      analytics.capture("app_boot", {});
    } catch (error) {
      posthog = null;
      console.warn("[Analytics] Failed to initialize PostHog:", error);
    }
  },

  enabled(): boolean {
    return Boolean(posthog);
  },

  identify(distinctId: string, props: AnalyticsProps = {}): void {
    if (!posthog || !distinctId) {
      return;
    }
    try {
      posthog.identify?.(distinctId, { ...getAppContext(), ...props });
    } catch (error) {
      console.warn("[Analytics] identify failed:", error);
    }
  },

  reset(): void {
    if (!posthog) {
      return;
    }
    try {
      posthog.reset?.();
    } catch (error) {
      console.warn("[Analytics] reset failed:", error);
    }
  },

  capture(event: string, props: AnalyticsProps = {}): void {
    if (!posthog || !event) {
      return;
    }

    try {
      posthog.capture?.(event, { ...props });
    } catch (error) {
      console.warn("[Analytics] capture failed:", error);
    }
  },

  screen(name: string, props: AnalyticsProps = {}): void {
    if (!posthog || !name) {
      return;
    }

    if (lastScreenName === name) {
      return;
    }

    lastScreenName = name;

    try {
      // posthog-react-native supports `screen` for screen views.
      posthog.screen?.(name, props);
      // Also capture a generic event for easier funnels.
      analytics.capture("screen_view", { screen: name, ...props });
    } catch (error) {
      console.warn("[Analytics] screen failed:", error);
    }
  },

  // Helper to log errors without leaking large payloads or secrets.
  captureError(event: string, error: unknown, props: AnalyticsProps = {}): void {
    const err =
      error instanceof Error
        ? { name: error.name, message: safeTruncate(error.message) }
        : { name: "unknown", message: safeTruncate(String(error)) };

    analytics.capture(event, { ...props, error_name: err.name, error_message: err.message });
  },
};


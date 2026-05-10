import * as Sentry from "@sentry/react-native";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const sentryEnvironment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
  (__DEV__ ? "development" : "production");

export const sentryNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export const isSentryEnabled = Boolean(sentryDsn);

if (isSentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    debug: __DEV__,
    environment: sentryEnvironment,
    integrations: [sentryNavigationIntegration],
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

export { Sentry };

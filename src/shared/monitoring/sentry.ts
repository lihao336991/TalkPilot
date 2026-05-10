import * as Sentry from "@sentry/react-native";
import {
  publicSentryDsn,
  publicSentryEnvironment,
} from "@/shared/config/publicEnv";

const sentryDsn = publicSentryDsn;
const sentryEnvironment = publicSentryEnvironment;

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

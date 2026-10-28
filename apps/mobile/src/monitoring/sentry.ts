import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

const extra = Constants.expoConfig?.extra as { sentryDsn?: string | null } | undefined;
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  || process.env.EXPO_SENTRY_DSN
  || extra?.sentryDsn
  || undefined;

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
  integrations: [navigationIntegration],
});

export { Sentry, navigationIntegration };

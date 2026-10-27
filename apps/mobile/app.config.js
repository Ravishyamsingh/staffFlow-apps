const appConfig = require("./app.json");

module.exports = ({ config }) => ({
  ...appConfig.expo,
  ...config,
  plugins: [
    ...(config.plugins ?? appConfig.expo.plugins ?? []),
    ["@sentry/react-native/expo", {
      url: "https://sentry.io/",
      ...(process.env.SENTRY_ORG ? { organization: process.env.SENTRY_ORG } : {}),
      ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
    }],
  ],
  extra: {
    ...config.extra,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? null,
    eas: {
      ...config.extra?.eas,
      ...(process.env.EXPO_PROJECT_ID ? { projectId: process.env.EXPO_PROJECT_ID } : {}),
    },
  },
});

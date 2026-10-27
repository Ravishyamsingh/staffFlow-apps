const appConfig = require("./app.json");

module.exports = ({ config }) => ({
  ...appConfig.expo,
  ...config,
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      ...(process.env.EXPO_PROJECT_ID ? { projectId: process.env.EXPO_PROJECT_ID } : {}),
    },
  },
});

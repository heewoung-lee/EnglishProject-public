const appJson = require('./app.json');

const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

function readEnv(name, fallback) {
  const value = process.env[name];

  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

module.exports = () => {
  const expo = appJson.expo;

  return {
    ...expo,
    plugins: [
      ...(expo.plugins ?? []),
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: readEnv('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID', TEST_ANDROID_APP_ID),
          iosAppId: readEnv('EXPO_PUBLIC_ADMOB_IOS_APP_ID', TEST_IOS_APP_ID),
          optimizeAdLoading: true,
          optimizeInitialization: true,
        },
      ],
    ],
  };
};

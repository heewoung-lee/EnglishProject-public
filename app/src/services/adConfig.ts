export type RuntimePlatform = 'android' | 'ios' | 'web' | 'windows' | 'macos';
type ExpoEnv = Record<string, string | undefined>;

declare const process: {
  env: ExpoEnv;
};

export function shouldEnableAds(env = getExpoEnv()) {
  const configuredValue = env.EXPO_PUBLIC_ADS_ENABLED?.trim().toLowerCase();

  return configuredValue !== 'false' && configuredValue !== '0';
}

export function shouldUseTestAds(env = getExpoEnv()) {
  return false;
}

export function getBannerAdUnitId(
  platform: RuntimePlatform = 'android',
  env = getExpoEnv(),
) {
  if (!shouldEnableAds(env) || platform === 'web') {
    return null;
  }

  const configuredUnitId = env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim();

  if (configuredUnitId) {
    return configuredUnitId;
  }

  return null;
}

function getExpoEnv(): ExpoEnv {
  return {
    EXPO_PUBLIC_ADS_ENABLED: process.env.EXPO_PUBLIC_ADS_ENABLED,
    EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID,
  };
}

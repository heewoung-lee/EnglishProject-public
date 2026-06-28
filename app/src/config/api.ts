const DEFAULT_API_BASE_URL = 'https://englishproject-c42b2.web.app';

type ExpoEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

export function getApiBaseUrl() {
  const env = (globalThis as ExpoEnv).process?.env;
  const configuredUrl = env?.EXPO_PUBLIC_API_BASE_URL;

  return (configuredUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

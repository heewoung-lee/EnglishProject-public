import { afterEach, describe, expect, it } from 'vitest';

import { getApiBaseUrl } from './api';

type ExpoEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const originalProcess = (globalThis as ExpoEnv).process;

afterEach(() => {
  (globalThis as ExpoEnv).process = originalProcess;
});

describe('getApiBaseUrl', () => {
  it('uses the public Firebase URL by default for standalone builds', () => {
    (globalThis as ExpoEnv).process = {
      env: {},
    };

    expect(getApiBaseUrl()).toBe('https://englishproject-c42b2.web.app');
  });

  it('allows an explicit development override and trims a trailing slash', () => {
    (globalThis as ExpoEnv).process = {
      env: {
        EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3001/',
      },
    };

    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });
});

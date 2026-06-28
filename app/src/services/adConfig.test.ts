import { describe, expect, it } from 'vitest';

import {
  getBannerAdUnitId,
  shouldEnableAds,
  shouldUseTestAds,
} from './adConfig';

describe('adConfig', () => {
  it('does not show ads unless a banner id is explicitly configured', () => {
    expect(getBannerAdUnitId('android', {})).toBeNull();
    expect(getBannerAdUnitId('ios', {})).toBeNull();
    expect(shouldUseTestAds({})).toBe(false);
  });

  it('uses the configured banner id when one is provided', () => {
    const env = {
      EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
    };

    expect(getBannerAdUnitId('android', env)).toBe('ca-app-pub-1234567890123456/1234567890');
    expect(shouldUseTestAds(env)).toBe(false);
  });

  it('does not show ads on web or when disabled', () => {
    expect(getBannerAdUnitId('web', {})).toBeNull();
    expect(shouldEnableAds({ EXPO_PUBLIC_ADS_ENABLED: 'false' })).toBe(false);
    expect(getBannerAdUnitId('android', { EXPO_PUBLIC_ADS_ENABLED: '0' })).toBeNull();
  });
});

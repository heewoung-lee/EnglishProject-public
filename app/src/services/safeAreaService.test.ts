import { describe, expect, it } from 'vitest';

import { getAndroidSafeAreaTopPadding } from './safeAreaService';

describe('safeAreaService', () => {
  it('uses the Android status bar height as top padding', () => {
    expect(getAndroidSafeAreaTopPadding('android', 24)).toBe(24);
  });

  it('does not add extra top padding on non-Android platforms', () => {
    expect(getAndroidSafeAreaTopPadding('ios', 24)).toBe(0);
    expect(getAndroidSafeAreaTopPadding('web', 24)).toBe(0);
  });

  it('falls back to zero for missing or invalid Android status bar heights', () => {
    expect(getAndroidSafeAreaTopPadding('android')).toBe(0);
    expect(getAndroidSafeAreaTopPadding('android', -8)).toBe(0);
  });
});

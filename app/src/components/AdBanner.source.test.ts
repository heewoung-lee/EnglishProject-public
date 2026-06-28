// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webSource = readFileSync(fileURLToPath(new URL('./AdBanner.tsx', import.meta.url)), 'utf8');
const nativeSource = readFileSync(
  fileURLToPath(new URL('./AdBanner.native.tsx', import.meta.url)),
  'utf8',
);

describe('AdBanner source', () => {
  it('does not load the native ad SDK on web', () => {
    expect(webSource).toContain('return null');
    expect(webSource).not.toContain('react-native-google-mobile-ads');
  });

  it('renders a banner ad with the configured unit id', () => {
    expect(nativeSource).toContain('getBannerAdUnitId(Platform.OS)');
    expect(nativeSource).toContain('BannerAdSize.BANNER');
    expect(nativeSource).toContain('unitId={unitId}');
  });

  it('does not show an empty ad frame before the banner loads', () => {
    expect(nativeSource).toContain('onAdLoaded');
    expect(nativeSource).toContain('onAdFailedToLoad');
    expect(nativeSource).toContain('styles.hiddenUntilLoaded');
  });

  it('keeps enough native space for the banner while loading', () => {
    expect(nativeSource).toContain('minHeight: 50');
    expect(nativeSource).not.toContain('height: 1');
  });
});

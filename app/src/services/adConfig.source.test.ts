// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./adConfig.ts', import.meta.url)), 'utf8');

describe('adConfig source', () => {
  it('uses static Expo public env reads so release bundles receive ad ids', () => {
    expect(source).toContain('process.env.EXPO_PUBLIC_ADS_ENABLED');
    expect(source).toContain('process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID');
    expect(source).not.toContain('globalThis');
  });

  it('does not embed Google test ad unit ids in release source', () => {
    expect(source).not.toContain('ca-app-pub-3940256099942544');
  });
});

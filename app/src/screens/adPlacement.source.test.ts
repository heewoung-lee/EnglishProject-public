// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readScreen(fileName: string) {
  return readFileSync(fileURLToPath(new URL(`./${fileName}`, import.meta.url)), 'utf8');
}

describe('result screen ad placement', () => {
  it.each([
    'PracticeResultScreen.tsx',
    'ConversationResultScreen.tsx',
    'PromotionResultScreen.tsx',
  ])('places one banner before the primary result action in %s', (fileName) => {
    const source = readScreen(fileName);
    const bannerIndex = source.indexOf('<AdBanner />');
    const buttonIndex = source.indexOf('style={styles.primaryButton}');

    expect(source).toContain("import { AdBanner } from '../components/AdBanner';");
    expect(bannerIndex).toBeGreaterThan(0);
    expect(buttonIndex).toBeGreaterThan(bannerIndex);
  });
});

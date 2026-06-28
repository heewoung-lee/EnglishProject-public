// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./PromotionResultScreen.tsx', import.meta.url)),
  'utf8',
);

describe('PromotionResultScreen source', () => {
  it('shows learner-friendly level names instead of CEFR codes', () => {
    expect(source).toContain('formatLevelTransitionLabel(result.fromLevel, result.toLevel)');
    expect(source).toContain('getLevelDisplayName(result.fromLevel)');
    expect(source).not.toContain('`${result.fromLevel} -> ${result.toLevel}`');
  });
});

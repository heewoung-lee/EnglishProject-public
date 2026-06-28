// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./PromotionExamScreen.tsx', import.meta.url)),
  'utf8',
);

describe('PromotionExamScreen source', () => {
  it('shows learner-friendly level names instead of CEFR codes', () => {
    expect(source).toContain('formatLevelTransitionLabel(fromLevel, toLevel)');
    expect(source).not.toContain('`${fromLevel} -> ${toLevel}`');
  });
});

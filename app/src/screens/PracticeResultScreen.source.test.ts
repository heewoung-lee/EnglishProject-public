// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../components/QuestionExplanationCard.tsx', import.meta.url)),
  'utf8',
);
const fallbackCopy = '로컬 기준으로 채점했습니다.';

describe('PracticeResultScreen source', () => {
  it('labels reading writing scores as reading scores', () => {
    expect(source).toContain('독해 점수');
    expect(source).toMatch(/item\.area\s*===\s*['"]reading['"]/);
  });

  it('does not expose local fallback implementation copy in learner-facing results', () => {
    expect(source).not.toContain(fallbackCopy);
  });

  it('does not hard-code misleading AI evaluation copy', () => {
    expect(source).not.toContain('AI 채점');
    expect(source).not.toContain('AI 평가');
  });
  it('renders the original question text in explanation cards when available', () => {
    expect(source).toMatch(/item\.questionText/);
    expect(source).toContain('지문:');
  });
});

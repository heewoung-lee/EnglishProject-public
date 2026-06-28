// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./ConversationResultScreen.tsx', import.meta.url)), 'utf8');
const fallbackCopy = '로컬 기준으로 채점했습니다.';

describe('ConversationResultScreen source', () => {
  it('does not expose local fallback implementation copy in learner-facing results', () => {
    expect(source).not.toContain(fallbackCopy);
  });

  it('does not hard-code misleading AI evaluation copy', () => {
    expect(source).not.toContain('AI 채점');
    expect(source).not.toContain('AI 평가');
  });

  it('puts concrete correction feedback inside the improvement section', () => {
    expect(source).toContain('buildConversationImprovementItems');
    expect(source).toContain('이렇게 바꿔 말해 보세요');
    expect(source).toContain('내 답변');
    expect(source).toContain('추천 표현');
    expect(source).not.toContain('교정 예시');
  });
});

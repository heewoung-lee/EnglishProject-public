// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');

describe('App source guardrails', () => {
  it('persists local proficiency stats when practice and promotion sessions finish', () => {
    expect(source).toContain('applySessionProficiencyStats');
    expect(source).toMatch(/const result = buildPracticeResult\(currentLearningState, session\);[\s\S]*const stateWithStats = applySessionProficiencyStats\(currentLearningState, session, completedAt\);[\s\S]*await savePracticeResult\(result, nextState\);/);
    expect(source).toMatch(/const result = buildPromotionExamResult\(currentLearningState, session\);[\s\S]*const stateWithStats = applySessionProficiencyStats\(currentLearningState, session, completedAt\);[\s\S]*await savePromotionResult\(result, nextState\);/);
  });
});

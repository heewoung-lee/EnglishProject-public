// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readScreen(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('feedback screen integration', () => {
  it('keeps practice question feedback neutral before the set result', () => {
    const source = readScreen('./PracticeQuestionScreen.tsx');

    expect(source).not.toContain('getAnswerSubmissionFeedback');
    expect(source).not.toContain('useFeedbackSounds');
    expect(source).not.toContain('playFeedbackSound');
    expect(source).not.toContain("playFeedbackSound('setPerfect')");
    expect(source).not.toContain("playFeedbackSound('setProgress')");
  });

  it('plays and animates practice set feedback on the result screen', () => {
    const source = readScreen('./PracticeResultScreen.tsx');
    const cardSource = readScreen('../components/QuestionExplanationCard.tsx');

    expect(source).toContain('getPracticeResultFeedback');
    expect(source).toContain('useFeedbackSounds');
    expect(source).toContain('setTimeout');
    expect(source).toContain('clearTimeout');
    expect(source).toContain('Animated.ScrollView');
    expect(source).toContain('QuestionExplanationCard');
    expect(cardSource).toContain('getRevealDelayMs(index)');
    expect(cardSource).toContain('writingRubric');
    expect(cardSource).toContain('writingScoreReasonsKo');
  });

  it('plays and animates promotion feedback on the promotion result screen', () => {
    const source = readScreen('./PromotionResultScreen.tsx');
    const cardSource = readScreen('../components/QuestionExplanationCard.tsx');

    expect(source).toContain('getPromotionResultFeedback');
    expect(source).toContain('useFeedbackSounds');
    expect(source).toContain('setTimeout');
    expect(source).toContain('clearTimeout');
    expect(source).toContain('Animated.ScrollView');
    expect(source).toContain('QuestionExplanationCard');
    expect(cardSource).toContain('getRevealDelayMs(index)');
  });
});

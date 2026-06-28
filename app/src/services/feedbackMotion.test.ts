import { describe, expect, it } from 'vitest';

import {
  getPracticeResultFeedback,
  getPromotionResultFeedback,
  getRevealDelayMs,
} from './feedbackMotion';
import type { PracticeSessionResult, PromotionExamResult } from '../types/learning';

function createPracticeResult(
  overrides: Partial<PracticeSessionResult> = {},
): PracticeSessionResult {
  return {
    sessionId: 'practice-session',
    level: 'A1',
    previousRate: 10,
    nextRate: 18,
    correctCount: 2,
    totalCount: 3,
    score: 66,
    promotionReady: false,
    questionIds: ['q1', 'q2', 'q3'],
    correctQuestionIds: ['q1', 'q2'],
    weakAreas: ['grammar'],
    weakSkillTags: [],
    explanations: [],
    ...overrides,
  };
}

function createPromotionResult(
  overrides: Partial<PromotionExamResult> = {},
): PromotionExamResult {
  return {
    sessionId: 'promotion-session',
    fromLevel: 'A1',
    toLevel: 'A2',
    passed: true,
    score: 82,
    passScore: 80,
    nextRate: 0,
    questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
    correctQuestionIds: ['q1', 'q2', 'q3', 'q4'],
    weakAreas: [],
    weakSkillTags: [],
    explanations: [],
    ...overrides,
  };
}

describe('feedbackMotion', () => {
  it('uses result-level feedback for a normal completed practice set', () => {
    expect(getPracticeResultFeedback(createPracticeResult())).toMatchObject({
      soundCue: 'setProgress',
      tone: 'review',
      rateCountDurationMs: 700,
    });
  });

  it('uses celebration feedback when a practice set unlocks promotion', () => {
    expect(getPracticeResultFeedback(createPracticeResult({ promotionReady: true }))).toMatchObject({
      soundCue: 'promotionReady',
      tone: 'promotion',
    });
  });

  it('uses a stronger success cue for a perfect set', () => {
    expect(getPracticeResultFeedback(createPracticeResult({
      correctCount: 3,
      correctQuestionIds: ['q1', 'q2', 'q3'],
      weakAreas: [],
    }))).toMatchObject({
      soundCue: 'setPerfect',
      tone: 'success',
    });
  });

  it('uses promotion-specific cues on exam results', () => {
    expect(getPromotionResultFeedback(createPromotionResult())).toMatchObject({
      soundCue: 'promotionPassed',
      tone: 'promotion',
    });

    expect(getPromotionResultFeedback(createPromotionResult({ passed: false, toLevel: null }))).toMatchObject({
      soundCue: 'promotionRetry',
      tone: 'review',
    });
  });

  it('staggers explanation cards without making long result pages feel slow', () => {
    expect(getRevealDelayMs(0)).toBe(180);
    expect(getRevealDelayMs(1)).toBe(270);
    expect(getRevealDelayMs(7)).toBe(630);
  });
});
